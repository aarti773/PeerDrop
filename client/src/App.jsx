import { useEffect } from "react";
import socket from "./config/socket";

function App() {
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server:", socket.id);
    });

    return () => {
      socket.off("connect");
    };
  }, []);

  return <h1>PeerDrop</h1>;
}

export default App;