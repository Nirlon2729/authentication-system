import "./Modal.css";

const Modal = ({
  open,
  title,
  children,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">

        <h2>{title}</h2>

        {children}

        <button
          className="modal-close"
          onClick={onClose}
        >
          Close
        </button>

      </div>
    </div>
  );
};

export default Modal;