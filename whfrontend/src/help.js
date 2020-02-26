import { Card, CardContent, CardHeader, Link, Typography } from "@material-ui/core";
import Highlight from "react-highlight";
import React from "react";

export default function Help(props) {
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
