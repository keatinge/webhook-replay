import { Badge, List, ListItem, ListItemText, ListSubheader, Typography } from "@material-ui/core";
import React from "react";
import DynamicRelTime from "./dynamic_rel_time";

export default function Reqs_list(props) {
    return (
        <List>
            <ListSubheader disableSticky={true}>
                Captured Requests: {props.idle && "(not updating, idle)"}
            </ListSubheader>
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
