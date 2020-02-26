import { makeStyles } from "@material-ui/core/styles";
import moment from "moment";
import { Tooltip } from "@material-ui/core";
import React from "react";

const useStylesBlackArrow = makeStyles(theme => ({
    arrow: {
        color: "black"
    },
    tooltip: {
        backgroundColor: "black"
    }
}));
export default function FullTime(props) {
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
