import { useState } from "react";
import { useCount } from "./useCount";

export default function Remote() {
  const { count, title, connected, increment, decrement, reset, setValue } = useCount();
  const [input, setInput] = useState("");

  const onReset = () => {
    if (window.confirm("Yakin nih? Gak kepencet kan?")) reset();
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (input === "") return;
    setValue(Number(input));
    setInput("");
  }

  return (
    <div className="remote">
      <h1>{title}</h1>
      <div className="remote-number">{count}</div>
      <div className={connected ? "status on" : "status off"}>
        {connected ? "Terhubung" : "Terputus"}
      </div>

      <button className="btn plus" onClick={increment}>+1</button>
      <button className="btn minus" onClick={decrement}>-1</button>

      <form className="set-form" onSubmit={onSubmit}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Isi angka manual!"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        <button type="submit" className="btn update" disabled={input === ""}>
          Update
        </button>
      </form>

      <button className="btn reset" onClick={onReset}>RESET</button>
    </div>
  );
}