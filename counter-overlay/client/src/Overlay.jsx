import { useCount } from "./useCount";

export default function Overlay() {
  const { count, title } = useCount();

  return (
    <div className="overlay">
      <div className="overlay-title">{title}</div>
      <div className="overlay-number">{count}</div>
    </div>
  );
}