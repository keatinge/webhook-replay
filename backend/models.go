package main

import (
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

type CreateResponse struct {
	Created_id int64   `json:"created_id"`
	Success    bool    `json:"success"`
	Error      *string `json:"error"`
}

type ErrorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
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

type User struct {
	ident string
	id    int64
}

type ReplayRequest struct {
	RequestID int64  `json:"request_id"`
	Endpoint  string `json:"endpoint"`
}

type ReplayResponse struct {
	ReplayID int64 `json:"replay_id"`
}

type RegisterResult struct {
	Ident string `json:"ident"`
}
