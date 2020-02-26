import React from "react";
import {
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle
} from "@material-ui/core";
import { Delete } from "@material-ui/icons";

export default function ResetButton(props) {
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
