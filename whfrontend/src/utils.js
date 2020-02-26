import { Typography } from "@material-ui/core";
import React from "react";

function BoldLabel(props) {
    return (
        <Typography variant={"subtitle2"} style={{ fontWeight: "700" }}>
            {props.text}
        </Typography>
    );
}

export { BoldLabel };
