import React from "react";
import ReactDOM from "react-dom";
import { withStyles } from "@material-ui/core/styles";
import {
    Button,
    AppBar,
    Typography,
    Toolbar,
    CssBaseline,
    Drawer,
    TextField,
    Link
} from "@material-ui/core";
import { Sync, GitHub } from "@material-ui/icons";
import "highlight.js/styles/docco.css";
import "./index.css";
import { WHReplay, getCookie } from "./whreplay";
import { SnackbarProvider, withSnackbar } from "notistack";

import ReqsList from "./reqs_list";
import CurrentReqDisplay from "./current_req_display";
import ResetButton from "./reset_button";
import Help from "./help";

const IS_DEV = document.location.origin.includes("localhost");
let BASE_URL = IS_DEV ? "http://localhost:5000" : `${document.location.origin}/replay`;

const drawerWidth = 400;

const styles = theme => ({
    root: {
        flexGrow: 1
    },
    appBar: {
        [theme.breakpoints.up("md")]: {
            width: `calc(100% - ${drawerWidth}px)`,
            marginLeft: drawerWidth
        }
    },
    title: {
        flexGrow: 1
    },
    drawer: {
        width: drawerWidth,
        flexShrink: 0,
        [theme.breakpoints.down("sm")]: {
            display: "none"
        }
    },
    drawerPaper: {
        width: drawerWidth
    },
    content: {
        [theme.breakpoints.up("md")]: {
            marginLeft: drawerWidth
        },
        flexGrow: 1,
        padding: theme.spacing(3)
    },
    toolbar: theme.mixins.toolbar,
    vertCentered: {
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        paddingBottom: 10
    },
    mobileOnlyReqList: {
        [theme.breakpoints.up("md")]: {
            display: "none"
        },
        marginTop: 15,
        maxHeight: "30vh",
        overflowY: "auto"
    }
});

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            reqs: [],
            curReqId: null,
            ident: "",
            replayUrl: "",
            idle: false
        };
    }

    async updateRequests(config) {
        console.log("Updating requests");
        if (this.state.idle) {
            console.log("Not updating, idle");
            return;
        }
        const defaults = {
            notify: false
        };
        const mergedConfig = Object.assign({}, defaults, config);
        const resp = await this.wh.getRequests();
        if (resp) {
            console.log("Done updating");
            this.setState({ reqs: resp.data });
            if (mergedConfig.notify) {
                this.props.enqueueSnackbar(
                    "Successfully synchronized requests and replays with server",
                    {
                        variant: "success"
                    }
                );
            }
            if (this.state.curReqId === null && resp.data.length > 0) {
                this.setState({ curReqId: resp.data[0].id });
            }
        }
        this.setState({ ident: getCookie("ident") });
    }

    async register() {
        const resp = await this.wh.register();
        if (resp) {
            this.props.enqueueSnackbar(`Registered as ${resp.data.ident}`, {
                variant: "info"
            });
            this.setState({ curReqId: null });
        }
        this.setState({ ident: getCookie("ident") });
        await this.updateRequests();
    }

    async registerIfNeeded() {
        const indentCookie = getCookie("ident");
        if (indentCookie === "") {
            console.log("Registering...");
            await this.register();
        } else {
            console.log("Not registering, ident exists");
            this.setState({ ident: indentCookie });
        }
    }

    async sendReplay() {
        console.log("Sending replay");

        if (this.state.replayUrl.length < 3) {
            this.props.enqueueSnackbar(
                "You must configure your replay url before you can send a replay!",
                { variant: "error", autoHideDuration: 15_000 }
            );
            return;
        }

        const currentReq = this.getCurrentReq();
        const resp = await this.wh.sendReplay(currentReq.id, this.state.replayUrl);
        if (resp) {
            console.log("Got response");
            this.props.enqueueSnackbar(`Replay completed`, { variant: "info" });
            await this.updateRequests();
        }
        this.setState({ ident: getCookie("ident") });
    }

    async componentDidMount() {
        const errFunc = e => {
            this.props.enqueueSnackbar(e, {
                variant: "error",
                autoHideDuration: 15_000
            });
        };
        this.wh = new WHReplay(BASE_URL, errFunc);
        await this.registerIfNeeded();
        await this.updateRequests();

        const second = 1_000;
        const minute = 60 * second;
        const updateDelay = 10 * second;
        this.interval = setInterval(this.updateRequests.bind(this), updateDelay);
        const maxIdleTime = 5 * minute;

        const setIdleFn = newIdle => {
            if (newIdle) {
                this.props.enqueueSnackbar(
                    "You are now idle, requests will stop automatically updating"
                );
            } else {
                this.props.enqueueSnackbar(
                    "You are no longer idle, requests will automatically update"
                );
            }
            this.setState({ idle: newIdle });
        };
        const onAction = () => {
            clearTimeout(this.idleTimeout);
            if (this.state.idle) {
                setIdleFn(false);
            }
            this.idleTimeout = setTimeout(() => setIdleFn(true), maxIdleTime);
        };
        onAction();
        document.onmousemove = onAction;
        document.onkeydown = onAction;
    }

    setCurReqId(curReqId) {
        this.setState({ curReqId });
    }

    getCurrentReq() {
        return this.state.reqs.filter(r => r.id === this.state.curReqId)[0];
    }

    render() {
        const currentReq = this.getCurrentReq();
        const classes = this.props.classes;
        const customUrl = `${BASE_URL}/create/${this.state.ident}/`;
        return (
            <div className={classes.root}>
                <CssBaseline />
                <AppBar position={"static"} className={classes.appBar}>
                    <Toolbar>
                        <Typography variant={"h6"} className={classes.title}>
                            Webhook Replay
                        </Typography>
                        <Link
                            style={{ marginRight: 20 }}
                            color={"inherit"}
                            href={"https://github.com/keatinge/webhook-replay"}
                            target={"_blank"}
                        >
                            <GitHub />
                        </Link>
                        <Button
                            color={"inherit"}
                            onClick={() => this.updateRequests({ notify: true })}
                        >
                            Sync <Sync />
                        </Button>
                        <ResetButton registerCallback={this.register.bind(this)} />
                    </Toolbar>
                </AppBar>
                <Drawer
                    className={classes.drawer}
                    variant="permanent"
                    classes={{ paper: classes.drawerPaper }}
                    anchor="left"
                >
                    <ReqsList
                        reqs={this.state.reqs}
                        setCurReqIdCallback={this.setCurReqId.bind(this)}
                        curReqId={this.state.curReqId}
                        idle={this.state.idle}
                    />
                </Drawer>
                <main className={classes.content}>
                    <Typography variant={"h5"}>
                        Custom URL: <code style={{ wordBreak: "break-all" }}>{customUrl}</code>
                    </Typography>
                    <div className={classes.vertCentered}>
                        <Typography
                            variant={"h5"}
                            style={{ display: "inline-block", paddingRight: 10 }}
                        >
                            Replay URL:{" "}
                        </Typography>
                        <TextField
                            style={{ flexGrow: 1 }}
                            placeholder={"https://your-server.com/your-endpoint"}
                            onChange={e => this.setState({ replayUrl: e.target.value })}
                        />
                    </div>
                    <div className={classes.mobileOnlyReqList}>
                        <ReqsList
                            reqs={this.state.reqs}
                            setCurReqIdCallback={this.setCurReqId.bind(this)}
                            curReqId={this.state.curReqId}
                            idle={this.state.idle}
                        />
                    </div>
                    {currentReq !== undefined && (
                        <CurrentReqDisplay
                            replayUrl={this.state.replayUrl}
                            req={currentReq}
                            sendReplayCallback={this.sendReplay.bind(this)}
                        />
                    )}
                    {currentReq === undefined && <Help customUrl={customUrl} />}
                </main>
            </div>
        );
    }
}

const StyledApp = withSnackbar(withStyles(styles)(App));
function StyledWithSnackbar() {
    return (
        <SnackbarProvider maxSnack={5}>
            <StyledApp />
        </SnackbarProvider>
    );
}
ReactDOM.render(<StyledWithSnackbar />, document.querySelector("#root"));
