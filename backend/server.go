package main

import (
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/labstack/gommon/log"
	_ "github.com/mattn/go-sqlite3"
	"os"
)

func main() {

	h := Handler{}
	err := h.Init("../replay.db")
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
			AllowCredentials: true,
		}))
	}

	e.Any("/create/:ident/*", h.create)
	e.GET("/requests", h.get_requests)
	e.POST("/replay", h.replay)
	e.POST("/register", h.register)

	path1 := "../whfrontend/build"
	path2 := "./whfrontend/build"
	if _, err := os.Stat(path1); err == nil {
		e.Static("/", path1)
	} else if _, err := os.Stat(path2); err == nil {
		e.Static("/", path2)
	} else {
		log.Fatal("Could not find static directory in %v or %v", path1, path2)

	}
	e.Logger.Fatal(e.Start(":5000"))
}
