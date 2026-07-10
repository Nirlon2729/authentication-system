import "./Checkbox.css";

const Checkbox = ({
  label,
  checked,
  onChange,
  name,
}) => {
  return (
    <label className="checkbox">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
      />

      <span>{label}</span>
    </label>
  );
};

export default Checkbox;