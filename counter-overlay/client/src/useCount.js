import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io();

export const useCount = () => {
    const [count, setCount] = useState(0);
    const [title, setTitle] = useState("");
    const [connected, setConnected] = useState(socket.connected);

    useEffect(() => {
        const onCount = (n) => setCount(n);
        const onTitle = (t) => {
            setTitle(t);
            document.title = t;
        };
        const onConnect = () => setConnected(true);
        const onDisconnect = () => setConnected(false);

        socket.on("count", onCount);
        socket.on("title", onTitle);
        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        
        return () => {
            socket.off("count", onCount);
            socket.off("title", onTitle);
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
        };
    }, []);

    return {
        count,
        title,
        connected,
        increment:  () => socket.emit("increment"),
        decrement:  () => socket.emit("decrement"),
        reset:      () => socket.emit("reset"),
        setValue:   (n) => socket.emit("set", n)
    };
}