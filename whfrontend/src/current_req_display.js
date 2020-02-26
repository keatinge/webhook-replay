import moment from "moment";
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    Divider,
    Grid,
    Typography
} from "@material-ui/core";
import React from "react";
import FullTime from "./full_time";
import HalfContainer from "./half_container";
import Slim2ColTable from "./slim_2_col_table";
import BodyViewer from "./body_viewer";
import { Replay } from "@material-ui/icons";

import ReplayedReq from "./replayed_req";

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

export default function Current_req_display(props) {
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
