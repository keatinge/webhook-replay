import React from "react";
import ReactDOM from "react-dom";
import { withStyles, makeStyles } from "@material-ui/core/styles";
import Highlight from "react-highlight";
import {
    Button,
    AppBar,
    Typography,
    Toolbar,
    CssBaseline,
    Drawer,
    List,
    ListItem,
    ListItemText,
    TextField,
    Divider,
    Card,
    CardHeader,
    CardContent,
    Grid,
    Table,
    TableRow,
    TableCell,
    TableBody,
    Paper,
    Tooltip,
    Chip,
    Badge,
    ListSubheader,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    CircularProgress,
    Link
} from "@material-ui/core";
import { Replay, Sync, Delete, GitHub } from "@material-ui/icons";
import "highlight.js/styles/docco.css";
import "./index.css"
import moment from "moment";
import { WHReplay, getCookie } from "./whreplay";
import { SnackbarProvider, withSnackbar } from "notistack";

const IS_DEV = document.location.origin.includes("localhost");
let BASE_URL = IS_DEV ? "http://localhost:5000" : `${document.location.origin}/replay`;

const drawerWidth = 400;

function Slim2ColTable(props) {
    if (typeof props.data == "undefined") {
        return "NO DATA";
    }
    return (
        <div style={{ overflowX: "auto" }}>
            <Table size={"small"}>
                <TableBody>
                    {props.data.map(r => (
                        <TableRow key={r[props.colKeys[0]] + r[props.colKeys[1]]}>
                            <TableCell style={{ whiteSpace: "nowrap" }}>
                                {r[props.colKeys[0]]}
                            </TableCell>
                            <TableCell style={{ width: "100%" }}>{r[props.colKeys[1]]}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function BodyViewer(props) {
    let prettyString = "";
    let lang = "json";
    try {
        prettyString = JSON.stringify(JSON.parse(props.text), null, 4);
    } catch (e) {
        prettyString = props.text;
        lang = "plaintext";
    }
    return (
        <div>
            <Typography variant={"h6"} style={{ marginTop: 40 }}>
                {props.title || "Request Body:"}
            </Typography>
            <div style={{ maxHeight: 1000, overflowY: "auto" }}>
                <Highlight className={lang}>{prettyString}</Highlight>
            </div>
        </div>
    );
}

function BoldLabel(props) {
    return (
        <Typography variant={"subtitle2"} style={{ fontWeight: "700" }}>
            {props.text}
        </Typography>
    );
}

function HalfContainer(props) {
    return (
        <Grid item xs={12} sm={12} md={6} style={{ overflowX: "auto" }}>
            {props.children}
        </Grid>
    );
}

function ReplayedReq(props) {
    const timingData = [
        {
            name: "Response time",
            value: `${moment(props.replay.end_at).diff(moment(props.replay.start_at), "ms")}ms`
        },
        {
            name: "Sent at",
            value: <FullTime time={props.replay.start_at} milli={true} />
        },
        {
            name: "Response at",
            value: <FullTime time={props.replay.end_at} milli={true} />
        }
    ];
    const code = props.replay.resp_code;
    const is_error = props.replay.err_str !== null;
    const body_text = is_error ? props.replay.err_str : props.replay.resp_body;
    const body_title = is_error ? "Error:" : "Response Body:";
    const is_good_status = code >= 200 && code <= 299;
    const chip_style = is_error || !is_good_status ? "secondary" : "primary";
    const chip_text = is_error ? "ERROR" : code.toString();
    return (
        <Paper elevation={3} style={{ padding: 10, marginBottom: 20 }}>
            <Typography variant={"h6"} style={{ marginBottom: 10 }}>
                {props.req.meth} {props.replay.loc}{" "}
                <Chip style={{ fontWeight: "700" }} color={chip_style} label={chip_text} />
            </Typography>
            <Divider />
            <Grid container spacing={1} style={{ marginTop: 10 }}>
                <HalfContainer>
                    <BoldLabel text={"Response Headers:"} />
                    <Slim2ColTable data={props.replay.resp_headers} colKeys={["Key", "Value"]} />
                </HalfContainer>
                <HalfContainer>
                    <BoldLabel text={"Response Timing:"} />
                    <Slim2ColTable data={timingData} colKeys={["name", "value"]} />
                </HalfContainer>
            </Grid>

            <BodyViewer text={body_text} title={body_title} />
        </Paper>
    );
}

class DynamicRelTime extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            actualTime: props.time,
            timeString: ""
        };
    }
    setTimeString(initialTime) {
        const time = moment(initialTime);
        const delta_t = moment().diff(time, "s");
        let timeString;
        if (delta_t < 60) {
            timeString = `${delta_t} seconds ago`;
        } else {
            timeString = time.fromNow();
        }
        this.setState({ timeString });
    }
    render() {
        return this.state.timeString;
    }
    componentDidMount() {
        const update = () => this.setTimeString(this.state.actualTime);
        update();
        const one_second = 1_000;
        const ten_seconds = 10 * one_second;
        this.timeInterval = setInterval(update, ten_seconds);
    }
    componentWillUnmount() {
        clearInterval(this.timeInterval);
    }
}

const useStylesBlackArrow = makeStyles(theme => ({
    arrow: {
        color: "black"
    },
    tooltip: {
        backgroundColor: "black"
    }
}));
function FullTime(props) {
    const classes = useStylesBlackArrow();
    const parsedTime = moment(props.time);

    return (
        <Tooltip arrow classes={classes} title={props.time}>
            {props.milli ? (
                <span>
                    {parsedTime.format("MMM Do h:mm")}.
                    <span style={{ fontSize: ".9em", opacity: 0.75, marginRight: 4 }}>
                        {parsedTime.format("SSS")}
                    </span>
                    {parsedTime.format("a")}
                </span>
            ) : (
                <span>{parsedTime.format("MMM Do h:mma")}</span>
            )}
        </Tooltip>
    );
}

function ReqsList(props) {
    return (
        <List>
            <ListSubheader disableSticky={true}>Captured Requests:</ListSubheader>
            {props.reqs.map(r => (
                <ListItem
                    button
                    key={r.id}
                    selected={r.id === props.curReqId}
                    onClick={() => props.setCurReqIdCallback(r.id)}
                >
                    <Badge badgeContent={r.replays.length} color={"primary"} variant="dot">
                        <ListItemText
                            primary={`${r.meth} ${r.loc}`}
                            secondary={<DynamicRelTime time={r.time} />}
                        />
                    </Badge>
                </ListItem>
            ))}
            {props.reqs.length === 0 && (
                <ListItem>
                    <Typography variant="body2" color="textSecondary" component="p">
                        You do not have any captured requests. Once you send a request to your
                        custom URL it will appear here.
                    </Typography>
                </ListItem>
            )}
        </List>
    );
}

function CurrentReqDisplay(props) {
    const numReplays = props.req.replays.length;
    const succReplays = props.req.replays.map(r => r.err_str === null).reduce((a, b) => a + b, 0);
    const failedReplays = numReplays - succReplays;
    const avgResponseTime =
        props.req.replays
            .map(r => {
                return moment(r.end_at).diff(moment(r.start_at), "ms");
            })
            .reduce((a, b) => a + b, 0) / numReplays;

    const stats = [
        {
            name: "Attempted replays:",
            value: numReplays.toString()
        },
        {
            name: "Successful replays:",
            value: succReplays.toString()
        },
        {
            name: "Failed replays:",
            value: failedReplays.toString()
        },
        {
            name: "Average response time:",
            value: isNaN(avgResponseTime)
                ? "N/A"
                : `${((1 / 100) * Math.round(100 * avgResponseTime)).toString()}ms`
        }
    ];

    return (
        <div>
            <Card>
                <CardHeader
                    title={`${props.req.meth} ${props.req.loc}`}
                    subheader={<FullTime time={props.req.time} />}
                />
                <CardContent>
                    <Grid container spacing={10}>
                        <HalfContainer>
                            <Typography variant={"h6"}>Request Headers:</Typography>
                            <Slim2ColTable data={props.req.headers} colKeys={["Key", "Value"]} />
                        </HalfContainer>
                        <HalfContainer>
                            <Typography variant={"h6"}>Replay Stats:</Typography>
                            <Slim2ColTable data={stats} colKeys={["name", "value"]} />
                        </HalfContainer>
                    </Grid>
                    <BodyViewer text={props.req.body} />
                </CardContent>
            </Card>
            <Divider style={{ margin: "10px 0px 10px 0px" }} />
            <ReplaysDisplay
                replayUrl={props.replayUrl}
                req={props.req}
                replays={props.req.replays}
                sendReplayCallback={props.sendReplayCallback}
            />
        </div>
    );
}

function SendReplayButton(props) {
    const [loading, setLoading] = React.useState(false);

    const clicked = async () => {
        if (!loading) {
            setLoading(true);
            await props.sendReplayCallback();
            setLoading(false);
        }
    };
    return (
        <Button variant="contained" color={"primary"} onClick={clicked}>
            {loading ? "Sending..." : "Send Replay"}
            {loading ? <CircularProgress color={"inherit"} size={20} /> : <Replay />}
        </Button>
    );
}

function ReplaysDisplay(props) {
    return (
        <Card style={{ marginTop: 20 }}>
            <CardHeader
                title={"Replays"}
                subheader={"Send the captured request to your replay URL and inspect the response"}
                action={
                    <SendReplayButton
                        replayUrl={props.replayUrl}
                        sendReplayCallback={props.sendReplayCallback}
                    />
                }
            />
            <CardContent>
                {props.replays.length === 0 && (
                    <p>
                        You haven't replayed this request yet. When you do, you will see the HTTP
                        responses here.
                    </p>
                )}
                {props.replays.map(r => (
                    <ReplayedReq key={r.id} replay={r} req={props.req} />
                ))}
            </CardContent>
        </Card>
    );
}

function ResetButton(props) {
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    const handleClose = () => setOpen(false);
    const handleOpen = () => setOpen(true);
    const handleReset = async () => {
        setLoading(true);
        handleClose();
        await props.registerCallback();
        setLoading(false);
    };
    return (
        <span>
            <Button color="inherit" onClick={handleOpen} disabled={loading}>
                Reset
                {loading && <CircularProgress color={"inherit"} size={20} />}
                {!loading && <Delete />}
            </Button>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>Are you sure you want to reset?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        You will lose all your captured requests and replays
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleReset} color={"secondary"}>
                        Reset
                    </Button>
                    <Button onClick={handleClose} color={"primary"}>
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>
        </span>
    );
}

function Help(props) {
    return (
        <div>
            <Card>
                <CardHeader
                    title={"You haven't received any requests yet!"}
                    subheader={"Send HTTP requests to your custom URL and they will appear here."}
                />
                <CardContent>
                    <Typography variant="body1" color="textSecondary" component="p">
                        For example, you could send the following HTTP request with cURL:
                    </Typography>
                    <Highlight className={"bash"}>
                        {`curl -X 'POST' \\
     -H 'content-type: application/json' \\
     --data '{"colors": [{"color": "red", "category": "hue", "type": "primary"}]}' \\
     ${props.customUrl}`}
                    </Highlight>
                    <Typography variant="body2" color="textSecondary" component="p">
                        Alternatively, you can send an HTTP request using your browser by clicking
                        here:
                        <Link href={props.customUrl} target={"_blank"}>
                            {" "}
                            {props.customUrl}
                        </Link>
                    </Typography>
                    <Typography
                        style={{ marginTop: 15 }}
                        variant="body2"
                        color="textSecondary"
                        component="p"
                    >
                        After you send a request. You can wait for the page to automatically update
                        (every 10 seconds), or click on the sync button on the top right to update
                        immediately.
                    </Typography>
                </CardContent>
            </Card>
        </div>
    );
}

const styles = theme => ({
    root: {
        flexGrow: 1
    },
    appBar: {
        [theme.breakpoints.up("md")]: {
            width: `calc(100% - ${drawerWidth}px)`,
            marginLeft: drawerWidth,
        }
    },
    title: {
        flexGrow: 1,
    },
    drawer: {
        width: drawerWidth,
        flexShrink: 0,
        [theme.breakpoints.down("sm")]: {
            display: "none",
        }
    },
    drawerPaper: {
        width: drawerWidth
    },
    content: {
        [theme.breakpoints.up("md")]: {
            marginLeft: drawerWidth,
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
            replayUrl: ""
        };

        this.interval = setInterval(this.updateRequests.bind(this), 10_000);
    }

    async updateRequests(config) {
        const defaults = {
            notify: false
        };
        const mergedConfig = Object.assign({}, defaults, config);
        console.log("Updating requests");
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
                    />
                </Drawer>
                <main className={classes.content}>
                    <Typography variant={"h5"}>
                        Custom URL: <code style={{wordBreak: "break-all"}}>{customUrl}</code>
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
