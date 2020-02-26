import { Grid } from "@material-ui/core";
import React from "react";

export default function HalfContainer(props) {
    return (
        <Grid item xs={12} sm={12} md={6} style={{ overflowX: "auto" }}>
            {props.children}
        </Grid>
    );
}
