import { createRoot } from "react-dom/client";
import Overlay from "./Overlay";
import Remote from "./Remote";
import "./styles.css";

const isRemote = window.location.pathname.startsWith("/remote");

createRoot(document.getElementById("root")).render(
  isRemote ? <Remote /> : <Overlay />
);