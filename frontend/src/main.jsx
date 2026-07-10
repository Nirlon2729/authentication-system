import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "./styles/base/variables.css";
import "react-toastify/dist/ReactToastify.css";
import "./styles/index.css";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import "./styles/base/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
 <React.StrictMode>
  <BrowserRouter>

    <AuthProvider>
  <App />

  <ToastContainer
    position="top-right"
    autoClose={3000}
    hideProgressBar={false}
    newestOnTop
    closeOnClick
    pauseOnHover
    draggable
    theme="light"
  />
</AuthProvider>

  </BrowserRouter>
</React.StrictMode>
);