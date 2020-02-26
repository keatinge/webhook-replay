import { Typography } from "@material-ui/core";
import Highlight from "react-highlight";
import React from "react";

export default function BodyViewer(props) {
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
