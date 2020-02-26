import moment from "moment";
import FullTime from "./full_time";
import { Chip, Divider, Grid, Paper, Typography } from "@material-ui/core";
import HalfContainer from "./half_container";
import Slim2ColTable from "./slim_2_col_table";
import BodyViewer from "./body_viewer";
import React from "react";
import { BoldLabel } from "./utils";

export default function ReplayedReq(props) {
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
