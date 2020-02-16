package main

import (
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/labstack/gommon/log"
	_ "github.com/mattn/go-sqlite3"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"time"
)

type SavedHeader struct {
	Key   string
	Value string
}

type SavedReq struct {
	Id       int64 `json:"id"`
	ident    string
	Meth     string        `json:"meth"`
	Rem_url  string        `json:"loc"`
	Body_str string        `json:"body"`
	Headers  []SavedHeader `json:"headers"`
	Rcv_time time.Time     `json:"time"`
	Replays  []Replay      `json:"replays"`
}

type ReplayDB struct {
	db *sql.DB
}

type Handler struct {
	rdb *ReplayDB
}

type CreateResponse struct {
	Created_id int64   `json:"created_id"`
	Success    bool    `json:"success"`
	Error      *string `json:"error"`
}

type ErrorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func (h *Handler) Init(db_file string) error {
	h.rdb = &ReplayDB{}
	err := h.rdb.Init(db_file)
	if err != nil {
		return err
	}
	return nil

}

func (rdb *ReplayDB) Init(db_file string) error {
	db, err := sql.Open("sqlite3", db_file)
	if err != nil {
		return err
	}
	rdb.db = db
	sql := `
	create table if not exists requests(id integer not null primary key, ident text not null, meth text not null, rem_url text not null, body text not null, recv_time datetime not null);
	create table if not exists headers(id integer not null primary key, req_id, replay_id, key text not null, value text not null);
	create table if not exists replays(id integer not null primary key, req_id integer not null, loc text, resp_code integer, resp_body text, start_at datetime, end_at datetime, err_str text);
	create table if not exists users(id integer not null primary key, create_date datetime, user_agent text, ip text, identifier text)
	`
	_, err = db.Exec(sql)
	if err != nil {
		return err
	}

	return nil

}

type Replay struct {
	Id          int64         `json:"id"`
	ReqId       int64         `json:"req_id"`
	Loc         string        `json:"loc"`
	RespCode    *int          `json:"resp_code"`
	RespBody    *string       `json:"resp_body"`
	StartAt     time.Time     `json:"start_at"`
	EndAt       time.Time     `json:"end_at"`
	RespHeaders []SavedHeader `json:"resp_headers"`
	ErrStr      *string       `json:"err_str"`
}

type HeaderType string

const HeaderTypeRequest = "req_id"
const HeaderTypeReplay = "replay_id"

func (rdb *ReplayDB) InsertAllHeaders(tx *sql.Tx, id int64, headers []SavedHeader, header_type HeaderType) error {

	if header_type != HeaderTypeRequest && header_type != HeaderTypeReplay {
		log.Fatalf("Illegal header type %q, this is very dangerous", header_type)
	}
	query := fmt.Sprintf("insert into headers(%s, key, value) VALUES (?, ?, ?)", header_type)
	for _, header := range headers {
		_, err := tx.Exec(query, id, header.Key, header.Value)
		if err != nil {
			return err
		}
	}
	return nil

}
func (rdb *ReplayDB) SaveReplay(replay *Replay) (int64, error) {
	tx, err := rdb.db.Begin()
	if err != nil {
		return -1, err
	}
	res, err := tx.Exec("insert into replays(req_id, loc, resp_code, resp_body, start_at, end_at, err_str) VALUES (?, ?, ?, ?, ?, ?, ?)",
		replay.ReqId, replay.Loc, replay.RespCode, replay.RespBody, replay.StartAt, replay.EndAt, replay.ErrStr)
	if err != nil {
		tx.Rollback()
		return -1, err
	}

	lid, err := res.LastInsertId()
	if err != nil {
		tx.Rollback()
		return -1, err
	}

	err = rdb.InsertAllHeaders(tx, lid, replay.RespHeaders, HeaderTypeReplay)
	if err != nil {
		tx.Rollback()
		return -1, err
	}

	err = tx.Commit()
	if err != nil {
		return -1, err
	}
	return lid, nil

}

func (rdb *ReplayDB) SaveRequest(req *SavedReq) (int64, error) {

	tx, err := rdb.db.Begin()
	if err != nil {
		return -1, err
	}

	res, err := tx.Exec("insert into requests(ident, meth, rem_url, body, recv_time) VALUES (?, ?, ?, ?, datetime('now'))", req.ident, req.Meth, req.Rem_url, req.Body_str)
	if err != nil {
		return -1, err
	}

	lid, err := res.LastInsertId()
	if err != nil {
		return -1, err
	}

	err = rdb.InsertAllHeaders(tx, lid, req.Headers, HeaderTypeRequest)
	if err != nil {
		return -1, err
	}

	err = tx.Commit()
	if err != nil {
		return -1, err
	}
	log.Printf("Insert %#v request with id %#v", req.Meth, lid)
	return lid, nil
}

func (rdb *ReplayDB) GetHeaders(id int64, htype HeaderType) ([]SavedHeader, error) {

	var rows *sql.Rows
	var err error
	if htype == HeaderTypeRequest {
		rows, err = rdb.db.Query("select key, value from headers where req_id = ?", id)
	} else if htype == HeaderTypeReplay {
		rows, err = rdb.db.Query("select key, value from headers where replay_id = ?", id)
	} else {
		panic(fmt.Sprintf("Illegal header type %q", htype))
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var headers = []SavedHeader{}
	for rows.Next() {
		var header SavedHeader
		err := rows.Scan(&header.Key, &header.Value)
		if err != nil {
			return nil, err
		}
		headers = append(headers, header)
	}

	return headers, nil

}

func (rdb *ReplayDB) GetRequestsForIdent(ident string) ([]SavedReq, error) {
	rows, err := rdb.db.Query("select id, meth, rem_url, body, recv_time from requests where ident = ? order by recv_time desc limit 50", ident)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ret = []SavedReq{}
	for rows.Next() {
		var req SavedReq
		err := rows.Scan(&req.Id, &req.Meth, &req.Rem_url, &req.Body_str, &req.Rcv_time)
		if err != nil {
			return nil, err
		}

		rows2, err2 := rdb.db.Query("select key, value from headers where req_id = ?", req.Id)
		if err2 != nil {
			return nil, err2
		}
		defer rows2.Close()

		headers, err := rdb.GetHeaders(req.Id, HeaderTypeRequest)
		if err != nil {
			return nil, err
		}
		req.Headers = headers

		rows3, err3 := rdb.db.Query("select id, loc, resp_code, resp_body, start_at, end_at, err_str from replays where req_id = ? order by end_at desc limit 50", req.Id)
		if err3 != nil {
			return nil, err3
		}
		defer rows3.Close()
		var replays = []Replay{}

		for rows3.Next() {
			var replay Replay
			err := rows3.Scan(&replay.Id, &replay.Loc, &replay.RespCode, &replay.RespBody, &replay.StartAt, &replay.EndAt, &replay.ErrStr)
			if err != nil {
				return nil, err
			}
			replay_headers, err := rdb.GetHeaders(replay.Id, HeaderTypeReplay)
			if err != nil {
				return nil, err
			}
			replay.RespHeaders = replay_headers
			replays = append(replays, replay)
		}
		req.Replays = replays

		ret = append(ret, req)
	}

	return ret, nil
}

func (rdb *ReplayDB) GetRequestByID(id int64) (*SavedReq, error) {
	row := rdb.db.QueryRow("select id, ident, meth, rem_url, body, recv_time from requests where id = ?", id)

	// TODO: DE-DUPE
	var req SavedReq
	err := row.Scan(&req.Id, &req.ident, &req.Meth, &req.Rem_url, &req.Body_str, &req.Rcv_time)
	if err != nil {
		return nil, err
	}

	rows2, err2 := rdb.db.Query("select key, value from headers where req_id = ?", req.Id)
	if err2 != nil {
		return nil, err
	}

	var headers []SavedHeader
	for rows2.Next() {
		var header SavedHeader
		err := rows2.Scan(&header.Key, &header.Value)
		if err != nil {
			return nil, err
		}
		headers = append(headers, header)
	}
	req.Headers = headers
	return &req, nil

}

func (rdb *ReplayDB) RegisterUser(user_agent, ip, ident string) (int64, error) {

	query := "insert into users(create_date, user_agent, ip, identifier) values (datetime('now'), ?, ?, ?) "
	res, err := rdb.db.Exec(query, user_agent, ip, ident)
	if err != nil {
		return -1, err
	}
	return res.LastInsertId()
}

func (rdb *ReplayDB) GetUserIdByIdent(ident string) (int64, error) {
	row := rdb.db.QueryRow("select id from users where identifier = ?", ident)
	var id int64 = -1
	err := row.Scan(&id)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("Unexpected error on GetUserById(%q) %q", ident, err)
		return -1, nil
	}
	return id, err
}

func (rdb *ReplayDB) GetNumReplaysAfter(t time.Time) (int64, error) {
	row := rdb.db.QueryRow("select count(*) from replays where end_at > ?", t)
	var count int64 = -1
	err := row.Scan(&count)
	return count, err
}

func (rdb *ReplayDB) Close() error {
	return rdb.db.Close()
}

type User struct {
	ident string
	id    int64
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
		fmt.Println(err)
		return bad_request(c, fmt.Sprintf("Invalid identification: %v, this url does not exist", ident))
	}

	url_string := c.Request().URL.String()
	meth := c.Request().Method

	body_bytes, err := ioutil.ReadAll(c.Request().Body)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Unable to read request, error %v", err.Error()))
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
		log.Fatal(err)
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
	return c.JSON(http.StatusUnauthorized, err_resp)
}

type ReplayRequest struct {
	RequestID int64  `json:"request_id"`
	Endpoint  string `json:"endpoint"`
}

type ReplayResponse struct {
	ReplayID int64 `json:"replay_id"`
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

	is_local := strings.Contains(http_req.URL.Host, "localhost") || strings.Contains(http_req.Host, "127.0.0.1")
	if is_local && !strings.HasPrefix(c.Request().RemoteAddr, "[::1]") {
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

type RegisterResult struct {
	Ident string `json:"ident"`
}

// This is not a request handler
func (h *Handler) register_from_context(c echo.Context) (*User, error) {
	user_agent := c.Request().Header.Get("User-Agent")

	ip := strings.SplitN(c.Request().RemoteAddr, ":", 2)[0]
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


func main() {

	h := Handler{}
	err := h.Init("replay.db")
	if err != nil {
		log.Fatal(err)
	}
	e := echo.New()
	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: "[${time_rfc3339}] method=${method}, uri=${uri}, status=${status}, error=${error}, ip=${remote_ip}, ua=${user_agent}, lat=${latency_human}, bin=${bytes_in}, bout=${bytes_out}, ident=${cookie:ident}\n",
	}))

	if os.Getenv("dev") == "true" {
		log.Printf("DEV: Allowing cross-origin requests")
		e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
			AllowCredentials:true,
		}))
	}

	e.Any("/create/:ident/*", h.create)
	e.GET("/requests", h.get_requests)
	e.POST("/replay", h.replay)
	e.POST("/register", h.register)
	e.Static("/", "whfrontend/build")
	e.Logger.Fatal(e.Start(":5000"))
}
