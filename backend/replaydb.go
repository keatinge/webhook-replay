package main

import (
	"database/sql"
	"fmt"
	"github.com/labstack/gommon/log"
	_ "github.com/mattn/go-sqlite3"
	"time"
)

type ReplayDB struct {
	db *sql.DB
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
	create table if not exists users(id integer not null primary key, create_date datetime, user_agent text, ip text, identifier text);
	
	create index if not exists requests_by_ident on requests(ident);
	create index if not exists headers_by_req on headers(req_id);
	create index if not exists headers_by_replay on headers(replay_id);
	create index if not exists replays_by_req on replays(req_id);
	create index if not exists users_by_ident on users(identifier);
	`
	_, err = db.Exec(sql)
	if err != nil {
		return err
	}

	return nil

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
		if header.Key == "X-Real-Ip" { // This is added by NGINX
			continue
		}
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
