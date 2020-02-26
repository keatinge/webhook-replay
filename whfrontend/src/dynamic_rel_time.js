import React from "react";
import moment from "moment";

export default class DynamicRelTime extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            actualTime: props.time,
            timeString: ""
        };
    }
    setTimeString(initialTime) {
        const time = moment(initialTime);
        const delta_t = moment().diff(time, "s");
        let timeString;
        if (delta_t < 60) {
            timeString = `${delta_t} seconds ago`;
        } else {
            timeString = time.fromNow();
        }
        this.setState({ timeString });
    }
    render() {
        return this.state.timeString;
    }
    componentDidMount() {
        const update = () => this.setTimeString(this.state.actualTime);
        update();
        const one_second = 1_000;
        const ten_seconds = 10 * one_second;
        this.timeInterval = setInterval(update, ten_seconds);
    }
    componentWillUnmount() {
        clearInterval(this.timeInterval);
    }
}
