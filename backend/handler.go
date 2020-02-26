package main

import (
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"github.com/labstack/echo/v4"
	"github.com/labstack/gommon/log"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"time"
)

func bad_request(c echo.Context, reason string) error {
	err_resp := ErrorResponse{Message: reason, Success: false}
	return c.JSON(http.StatusBadRequest, err_resp)
}

func internal_error(c echo.Context, reason string) error {
	err_resp := ErrorResponse{Message: reason, Success: false}
	return c.JSON(http.StatusInternalServerError, err_resp)
}

func unauthorized(c echo.Context) error {
	err_resp := ErrorResponse{Message: "Unauthorized", Success: false}
	return c.JSON(http.StatusUnauthorized, err_resp)
}

func rate_limited(c echo.Context, msg string) error {
	err_resp := ErrorResponse{Message: msg, Success: false}
	return c.JSON(http.StatusTooManyRequests, err_resp)
}

type Handler struct {
	rdb    *ReplayDB
	is_dev bool
}

func (h *Handler) Init(db_file string) error {
	h.rdb = &ReplayDB{}
	err := h.rdb.Init(db_file)
	if err != nil {
		return err
	}
	h.is_dev = os.Getenv("dev") == "true"
	return nil

}

func (h *Handler) GetUserByIdent(ident string) (*User, error) {
	id, err := h.rdb.GetUserIdByIdent(ident)

	return &User{ident: ident, id: id}, err

}
func (h *Handler) GetUserByContext(c echo.Context) (*User, error) {
	ident, err := c.Cookie("ident")

	if err != nil {
		return nil, errors.New("Could not find ident cookie")
	}

	ident_str := ident.Value
	if len(ident_str) == 0 {
		return nil, errors.New("Missing ident")
	}

	user, err := h.GetUserByIdent(ident_str)
	if err == sql.ErrNoRows { // Identification exists but it isn't correct
		log.Printf("Auth failed for %q, registering new user", ident)
		new_user, new_err := h.register_from_context(c)
		return new_user, new_err
	}

	if err != nil {
		log.Printf("Unexpected error on GetUserByContext(%q) %q", ident, err)
		return nil, errors.New("Unauthorized")
	}
	return user, err

}

func (h *Handler) create(c echo.Context) error {

	ident := c.Param("ident")
	user, err := h.GetUserByIdent(ident)
	if err != nil {
		return bad_request(c, fmt.Sprintf("Invalid identification: %v, this url does not exist", ident))
	}

	url_string := c.Request().URL.String()
	meth := c.Request().Method

	body_bytes, err := ioutil.ReadAll(c.Request().Body)
	if err != nil {
		return bad_request(c, fmt.Sprintf("Unable to read request, error %v", err.Error()))
	}
	body_str := string(body_bytes)

	var saved_headers []SavedHeader = nil
	for header, header_vals := range c.Request().Header {
		if header == "Accept-Encoding" {
			continue
		}
		saved_headers = append(saved_headers, SavedHeader{header, strings.Join(header_vals, ",")})
	}

	req := SavedReq{
		ident:    user.ident,
		Meth:     meth,
		Rem_url:  url_string,
		Body_str: body_str,
		Headers:  saved_headers,
	}
	inserted_id, err := h.rdb.SaveRequest(&req)
	if err != nil {
		return internal_error(c, fmt.Sprintf("Unable to save request to db %v", err))
	}
	log.Printf("Created request with id %v in response to request to %v", inserted_id, url_string)
	resp := CreateResponse{
		Created_id: inserted_id,
		Success:    true,
		Error:      nil,
	}
	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) get_requests(c echo.Context) error {
	user, err := h.GetUserByContext(c)
	if err != nil {
		return bad_request(c, err.Error())
	}

	reqs, err := h.rdb.GetRequestsForIdent(user.ident)
	if err != nil {
		return internal_error(c, err.Error())
	}
	log.Printf("Successfully Returning %v requests for user %v", len(reqs), user)
	return c.JSON(http.StatusOK, reqs)
}

// This is not a request handler
func (h *Handler) register_from_context(c echo.Context) (*User, error) {
	user_agent := c.Request().Header.Get("User-Agent")

	ip := c.Request().Header.Get("X-Real-Ip")
	rand_buf := make([]byte, 16)
	_, err := rand.Read(rand_buf)
	if err != nil {
		return nil, errors.New(fmt.Sprintf("Register: failed to generate random bytes %v", err))
	}
	ident := base64.RawURLEncoding.EncodeToString(rand_buf)
	user_id, err := h.rdb.RegisterUser(user_agent, ip, ident)
	log.Printf("Registered user id: %v with ident: %v", user_id, ident)
	if err != nil {
		return nil, errors.New("Could not save registered user to db")
	}

	cookie := http.Cookie{
		Name:    "ident",
		Value:   ident,
		Expires: time.Now().UTC().Add(10 * 365 * 24 * time.Hour), // Expire in 10 years
	}
	c.SetCookie(&cookie)

	return &User{
		ident: ident,
		id:    user_id,
	}, nil

}

func (h *Handler) register(c echo.Context) error {

	user, err := h.register_from_context(c)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, RegisterResult{user.ident})

}

func (h *Handler) replay_error_response(c echo.Context, req_id int64, loc string, start_at time.Time, end_at time.Time, err_str string) error {

	replay := Replay{
		ReqId:       req_id,
		Loc:         loc,
		RespCode:    nil,
		RespBody:    nil,
		StartAt:     start_at,
		EndAt:       end_at,
		RespHeaders: nil,
		ErrStr:      &err_str,
	}
	replay_id, replay_err := h.rdb.SaveReplay(&replay)
	if replay_err != nil {
		return internal_error(c, fmt.Sprintf("Request failed for %s and was unable to save replay for %s", err_str, replay_err))
	}
	return c.JSON(http.StatusOK, ReplayResponse{ReplayID: replay_id})

}

type Limit struct {
	how_far_back        time.Duration
	num_replays_allowed int64
}

func checkRateLimits(rdb *ReplayDB) error {
	limits := []Limit{
		{how_far_back: 10 * time.Second, num_replays_allowed: 5},
		{how_far_back: 1 * time.Minute, num_replays_allowed: 30},
		{how_far_back: 1 * time.Hour, num_replays_allowed: 1_000},
		{how_far_back: 24 * time.Hour, num_replays_allowed: 10_000},
	}

	for i, lim := range limits {
		period_start := time.Now().UTC().Add(-1 * lim.how_far_back)
		n_in_period, err := rdb.GetNumReplaysAfter(period_start)
		if err != nil {
			return err
		}
		if n_in_period > lim.num_replays_allowed {
			e_string := fmt.Sprintf("Limit %d exceeded with %d replays (%d allowed)", i, n_in_period, lim.num_replays_allowed)
			return errors.New(e_string)
		}

	}
	return nil

}

func (h *Handler) replay(c echo.Context) error {

	rl_error := checkRateLimits(h.rdb)

	if rl_error != nil {
		return rate_limited(c, rl_error.Error())
	}
	user, err := h.GetUserByContext(c)
	if err != nil {
		return bad_request(c, err.Error())
	}

	var replay_req ReplayRequest

	if err := c.Bind(&replay_req); err != nil {
		return bad_request(c, fmt.Sprintf("Could not bind to replay request model %q", err))
	}

	id := replay_req.RequestID

	if len(replay_req.Endpoint) <= 0 {
		return bad_request(c, "Missing endpoint")
	}

	saved_req, err := h.rdb.GetRequestByID(id)
	if err != nil {
		return bad_request(c, fmt.Sprintf("Could not get request with id %q, error: %q", id, err))
	}

	if subtle.ConstantTimeCompare([]byte(saved_req.ident), []byte(user.ident)) != 1 {
		return unauthorized(c)
	}

	http_req, err := http.NewRequest(saved_req.Meth, replay_req.Endpoint, strings.NewReader(saved_req.Body_str))
	if err != nil {
		return bad_request(c, fmt.Sprintf("Unable to create http request, error: %q", err))
	}

	host_lower := strings.ToLower(http_req.URL.Host)
	is_local := strings.Contains(host_lower, "localhost") || strings.Contains(host_lower, "127.0.0.1")
	if is_local && !h.is_dev {
		return bad_request(c, fmt.Sprintf("Host %v not allowed", http_req.URL.Host))
	}

	for _, header := range saved_req.Headers {
		http_req.Header.Set(header.Key, header.Value)
	}

	log.Printf("Starting request: %v %v for %v", http_req.Method, http_req.URL.String(), user)
	client := http.Client{Timeout: 5 * time.Second}
	t_start := time.Now().UTC()
	resp, err := client.Do(http_req)

	if err != nil {
		err_str := fmt.Sprintf("Couldn't client.do request, error %q", err)
		return h.replay_error_response(c, id, replay_req.Endpoint, t_start, time.Now().UTC(), err_str)
	}

	b, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		err_str := fmt.Sprintf("Unable to read response body, error %q", err)
		return h.replay_error_response(c, id, replay_req.Endpoint, t_start, time.Now().UTC(), err_str)
	}
	body_str := string(b)
	t_end := time.Now().UTC()
	replay := Replay{
		ReqId:       id,
		Loc:         replay_req.Endpoint,
		RespCode:    &resp.StatusCode,
		RespBody:    &body_str,
		StartAt:     t_start,
		EndAt:       t_end,
		RespHeaders: nil,
		ErrStr:      nil,
	}

	for header, header_vals := range resp.Header {
		replay.RespHeaders = append(replay.RespHeaders, SavedHeader{header, strings.Join(header_vals, ",")})
	}

	replay_id, replay_err := h.rdb.SaveReplay(&replay)

	if replay_err != nil {
		return internal_error(c, fmt.Sprintf("Unable to save replay because %s", replay_err))
	}

	return c.JSON(http.StatusOK, ReplayResponse{ReplayID: replay_id})

}
