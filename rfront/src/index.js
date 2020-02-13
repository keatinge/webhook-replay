import React from "react";
import ReactDOM from "react-dom";
import moment from "moment";
import "./index.css";
import "./foundation.min.css";

let base_url = document.location.origin.includes("localhost")
    ? document.location.origin
    : document.location.origin + "/replay";

function InfoBox(props) {
    return (
        <div className="info-box">
            <div className={"flex-apart"}>
                <h5
                    className={"send-req"}
                    style={{ display: "inline-block", fontSize: "1.1rem" }}
                >
                    Send requests to {props.custom_url}
                </h5>
                <button className={"button success"} onClick={props.refresh_cb}>
                    Refresh
                </button>
            </div>
            <div className="grid-x">
                <div>Where would you like to receive replays?</div>
                <input
                    type="text"
                    style={{ width: "100%" }}
                    placeholder={"https://example.org"}
                    value={props.url}
                    onChange={props.on_change_cb}
                />
            </div>
        </div>
    );
}

function Header(props) {
    return (
        <div className="header-bar">
            <h4>Request Replay</h4>
        </div>
    );
}

function ReqListItem(props) {
    let time = moment(props.data.time);
    let delta_t = moment().diff(time, "s");
    let time_str = time.fromNow();
    if (delta_t < 60) {
        time_str = `${delta_t} seconds ago`;
    }

    return (
        <div className="sidebar-req" onClick={() => props.cb(props.data)}>
            <div className="top-text">
                <span className={"primary label"}>{props.data.meth}</span>{" "}
                <code>{props.data.loc}</code>
            </div>
            <div className="bottom-text">{time_str}</div>
        </div>
    );
}

function ReqList(props) {
    return (
        <div className="cell medium-3 y-scroll">
            <div className="left-sidebar">
                {props.requests.map(r => (
                    <ReqListItem data={r} cb={props.cb} />
                ))}
            </div>
        </div>
    );
}

function DateTime(props) {
    let time = moment(props.dt);

    return (
        <span
            data-tooltip
            aria-haspopup="true"
            data-disable-hover="false"
            className={"has-tip"}
            title={time.format()}
        >
            {time.format("h:mm:ss")}
            <span className={"small-ms"}>.{time.format("SSS")}</span>{" "}
            {time.format("a")} - {time.fromNow()}
        </span>
    );
}

class Replay extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let is_error = this.props.replay.err_str !== null;
        let class_str = is_error ? "alert" : "success";

        return (
            <div className={"fade-in callout " + class_str} style={this.state}>
                <h5>
                    {this.props.request.meth} {this.props.replay.loc}
                    {!is_error && (
                        <span className={"primary label status-label"}>
                            {this.props.replay.resp_code}
                        </span>
                    )}
                    {is_error && (
                        <span className={"alert label status-label"}>
                            ERROR
                        </span>
                    )}
                </h5>

                <div className={"info-tables"}>
                    <div className={"table-container"}>
                        <label className={"viz-body-label"}>
                            Response headers:
                        </label>
                        <table className={"slim-table"}>
                            <tbody>
                                {this.props.replay.resp_headers.map(h => (
                                    <tr>
                                        <td>{h.Key}:</td>
                                        <td>{h.Value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className={"table-container"}>
                        <label className={"viz-body-label"}>
                            Response timing:
                        </label>
                        <table className={"slim-table"}>
                            <tbody>
                                <tr>
                                    <td>Response time:</td>
                                    <td>
                                        {moment(this.props.replay.end_at).diff(
                                            moment(this.props.replay.start_at),
                                            "ms"
                                        )}
                                        ms
                                    </td>
                                </tr>
                                <tr>
                                    <td>Sent at:</td>
                                    <td>
                                        <DateTime
                                            dt={this.props.replay.start_at}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td>Response at:</td>
                                    <td>
                                        <DateTime
                                            dt={this.props.replay.end_at}
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {is_error && (
                    <div>
                        <label className={"viz-body-label"}>Error:</label>
                        <ReqBodyViz body={this.props.replay.err_str} />
                    </div>
                )}

                {!is_error && (
                    <div>
                        <label className={"viz-body-label"}>
                            Response body:
                        </label>
                        <ReqBodyViz body={this.props.replay.resp_body} />
                    </div>
                )}
            </div>
        );
    }
}

function Replays(props) {
    let has_scheme =
        props.recv_url.startsWith("http://") ||
        props.recv_url.startsWith("https://");
    let is_disabled = !has_scheme || props.recv_url.length < 8; // 8 because http:// are counted here

    let btn_text = is_disabled
        ? `You must configure your replay URL above before you can send a replay`
        : `Send new replay! ${props.request.meth} to ${props.recv_url}`;

    return (
        <div className="replays-box">
            <h3>Replays</h3>
            <button
                className="button"
                onClick={() => props.send_new_replay_cb(props.request)}
                disabled={is_disabled}
                style={{ opacity: is_disabled ? 0.75 : 1.0 }}
            >
                {btn_text}
            </button>

            {props.replays.map(r => (
                <Replay key={r.id} request={props.request} replay={r} />
            ))}
        </div>
    );
}

class ReqBodyViz extends React.Component {
    constructor(props) {
        super(props);

        let json_formatted = null;
        let json_body = null;
        try {
            json_body = JSON.parse(props.body);
            json_formatted = JSON.stringify(json_body, null, 2);
        } catch (e) {
            // Not JSON
        }
        this.state = {
            json_body: json_body,
            json_fmt: json_formatted
        };
    }

    render() {
        return (
            <pre className={"viz-body"}>
                {this.state.json_fmt ? this.state.json_fmt : this.props.body}
            </pre>
        );
    }
}

function ViewReq(props) {
    let json_formatted = null;
    let json_body = null;
    try {
        json_body = JSON.parse(props.request.body);
        json_formatted = JSON.stringify(json_body, null, 2);
    } catch (e) {}

    let n_replays = props.request.replays.length;
    let succ_replays = props.request.replays
        .map(r => r.err_str !== null)
        .reduce((a, b) => a + b, 0);
    let failled_replays = n_replays - succ_replays;
    let avg_response_time =
        props.request.replays
            .map(r => {
                return moment(r.end_at).diff(moment(r.start_at), "ms");
            })
            .reduce((a, b) => a + b, 0) / n_replays;

    return (
        <div className="cell medium-9 y-scroll">
            <div className="right-sidebar">
                <h3 className={"sidebar-title"}>
                    {props.request.meth} {props.request.loc}
                </h3>
                <h5 className={"sidebar-subtitle"}>
                    {props.request.time}
                    <span style={{ "font-size": ".8em" }}>
                        <DateTime dt={props.request.time} />
                    </span>
                </h5>

                <div className="grid-x">
                    <div className="cell medium-6">
                        <div
                            className="right-table"
                            style={{ paddingRight: "10px" }}
                        >
                            <h5>Request Headers:</h5>
                            <table className={"table-no-overflow"}>
                                <tbody>
                                    {props.request.headers.map(h => (
                                        <tr>
                                            <td>{h.Key}</td>
                                            <td>{h.Value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="cell medium-6">
                        <div
                            className="right-table"
                            style={{ paddingLeft: "10px" }}
                        >
                            <h5>Replay Stats:</h5>
                            <table className={"table-no-overflow"}>
                                <tbody>
                                    <tr>
                                        <td>Attempted Replays:</td>
                                        <td>{n_replays}</td>
                                    </tr>
                                    <tr>
                                        <td>Successful Replays:</td>
                                        <td>{succ_replays}</td>
                                    </tr>
                                    <tr>
                                        <td>Failed Replays:</td>
                                        <td>{failled_replays}</td>
                                    </tr>
                                    <tr>
                                        <td>Average Response time</td>
                                        <td>
                                            {isNaN(avg_response_time)
                                                ? ""
                                                : avg_response_time + " ms"}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="right-section">
                    <h5>Request Body:</h5>
                    <pre className={"req-body"}>{props.request.body}</pre>
                </div>

                {json_formatted !== null && (
                    <div className="right-section">
                        <h5>Formatted JSON:</h5>
                        <pre className={"req-body"}>{json_formatted}</pre>
                    </div>
                )}

                <Replays
                    request={props.request}
                    replays={props.request.replays}
                    send_new_replay_cb={props.send_new_replay_cb}
                    recv_url={props.recv_url}
                />
            </div>
        </div>
    );
}

function Help(props) {
    return (
        <div className={"cell medium-9"} style={{ padding: 20 }}>
            <div className={"callout"}>
                <h5>You haven't received any requests!</h5>
                <p>
                    Send an http request to <code>{props.custom_url}</code> to
                    get started! For example, you could send the following
                    request with curl:
                </p>
                <pre className={"req-body"}>
                    curl --header 'Content-Type: application/json' \<br />
                    --request POST \<br />
                    --data '&#123;"hello": "world" &#125;' \<br />
                    {props.custom_url}
                </pre>
                <p>
                    Or you can send an HTTP request using your browser by
                    clicking here:{" "}
                    <a href={props.custom_url}>{props.custom_url}</a>
                </p>
            </div>
        </div>
    );
}

//https://stackoverflow.com/questions/5639346
function get_cookie(a) {
    let b = document.cookie.match("(^|[^;]+)\\s*" + a + "\\s*=\\s*([^;]+)");
    return b ? b.pop() : "";
}

class MainPage extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            current_req_id: null,
            requests: [],
            recv_url: "",
            ident: ""
        };
        this.set_req_cb = this.set_req.bind(this);
    }

    get_custom_url() {
        return base_url + "/create/" + this.state.ident + "/";
    }

    error_message(msg) {
        alert(msg);
        throw new Error(msg);
    }

    async bad_response_error(url, response) {
        let text;
        try {
            text = await response.text();
        } catch (e) {
            text = e.toString();
        }
        let msg = `Request to ${url} returned status code ${response.status} ${response.statusText}: ${text}`;
        this.error_message(msg);
    }

    async err_checked_fetch(url, opts) {
        let fetch_res;
        try {
            fetch_res = await fetch(url, opts);
        } catch (e) {
            let error_msg = `Failed to fetch ${url} with ${opts}: ${e}`;
            this.error_message(error_msg);
        }

        if (!fetch_res.ok) {
            this.bad_response_error(url, fetch_res);
        }
        this.setState({ ident: get_cookie("ident") });
        return fetch_res;
    }

    async update() {
        console.log("Updating");
        let url = base_url + "/requests";
        console.log("UPdating");

        let resp = await this.err_checked_fetch(url);
        let resp_json = await resp.json();
        this.setState({ requests: resp_json });
        if (this.state.current_req_id === null && resp_json.length > 0) {
            this.setState({ current_req_id: resp_json[0].id });
        }
    }

    async componentDidMount() {
        await this.register_if_needed();
        this.update();
        setInterval(this.update.bind(this), 10_000);
    }

    set_req(req) {
        this.setState({ current_req_id: req.id });
    }

    on_url_change(event) {
        this.setState({ recv_url: event.target.value });
    }

    async send_new_replay(req) {
        console.log("Sending new replay for req", req);
        let url = base_url + "/replay";
        let resp = await this.err_checked_fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                request_id: req.id,
                endpoint: this.state.recv_url
            })
        });
        let json_resp = await resp.json();
        await this.update();
        console.log("Got response", json_resp);
    }

    async register_if_needed() {
        let ident_cookie = get_cookie("ident");
        if (ident_cookie === "") {
            let url = base_url + "/register";
            let resp = await this.err_checked_fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            });
            console.log(resp);
            let new_ident = get_cookie("ident");
            console.log("Creating new registration", new_ident);
            this.setState({ ident: new_ident });
        } else {
            console.log("Already registered as", ident_cookie);
            this.setState({ ident: ident_cookie });
        }
    }

    render() {
        let side_by_side = this.state.current_req !== null;

        let req_table_class =
            "cell " + (side_by_side ? "medium-4" : "medium-8");

        let current_req = null;
        for (let i = 0; i < this.state.requests.length; i++) {
            if (this.state.requests[i].id === this.state.current_req_id) {
                current_req = this.state.requests[i];
            }
        }

        return (
            <div className="main-container">
                <Header />
                <InfoBox
                    refresh_cb={this.update.bind(this)}
                    url={this.state.recv_url}
                    custom_url={this.get_custom_url()}
                    on_change_cb={this.on_url_change.bind(this)}
                    ident={this.state.ident}
                />
                <div className="grid-x">
                    <ReqList
                        requests={this.state.requests}
                        cb={this.set_req_cb}
                    />
                    {this.state.requests.length === 0 && (
                        <Help custom_url={this.get_custom_url()} />
                    )}
                    {current_req !== null && (
                        <ViewReq
                            request={current_req}
                            send_new_replay_cb={this.send_new_replay.bind(this)}
                            recv_url={this.state.recv_url}
                        />
                    )}
                </div>
            </div>
        );
    }
}

// ========================================

ReactDOM.render(<MainPage />, document.getElementById("root"));
