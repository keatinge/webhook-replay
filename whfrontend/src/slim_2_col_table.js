import { Table, TableBody, TableCell, TableRow } from "@material-ui/core";
import React from "react";

export default function Slim2ColTable(props) {
    if (typeof props.data == "undefined") {
        throw new Error("No data for Slim2ColTable");
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
