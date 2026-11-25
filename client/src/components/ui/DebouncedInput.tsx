import * as React from "react";
import { Input } from "./input";

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
    value: string;
    onValueChange: (value: string) => void;
    /** ms to wait after the last keystroke before telling the parent (default 250) */
    delay?: number;
};

/**
 * Search box that keeps the text it shows in its OWN state, so each keystroke only
 * re-renders this tiny component. The parent (often a huge page like AdminDashboard)
 * is only updated after the user pauses typing, so typing never lags.
 */
export const DebouncedInput = React.memo(function DebouncedInput({
    value,
    onValueChange,
    delay = 250,
    ...rest
}: Props) {
    const [local, setLocal] = React.useState(value ?? "");
    const lastCommitted = React.useRef(value ?? "");
    const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const cb = React.useRef(onValueChange);
    cb.current = onValueChange;

    // Parent changed the value (e.g. a "clear" button) -> reflect it.
    React.useEffect(() => {
        if ((value ?? "") !== lastCommitted.current) {
            lastCommitted.current = value ?? "";
            setLocal(value ?? "");
        }
    }, [value]);

    React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    return (
        <Input
            {...rest}
            value={local}
            onChange={(e) => {
                const v = e.target.value;
                setLocal(v);
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => {
                    lastCommitted.current = v;
                    cb.current(v);
                }, delay);
            }}
        />
    );
});