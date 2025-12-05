"use client";

import React from "react";
import { ToastContainer, toast as toastify } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  duration?: number;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
}

export const toast = {
  success: (message: string, options?: ToastOptions) => {
    toastify(message, {
      type: "success",
      autoClose: options?.duration || 3000,
      position: options?.position || "top-right",
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  },
  error: (message: string, options?: ToastOptions) => {
    toastify(message, {
      type: "error",
      autoClose: options?.duration || 4000,
      position: options?.position || "top-right",
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  },
  info: (message: string, options?: ToastOptions) => {
    toastify(message, {
      type: "info",
      autoClose: options?.duration || 3000,
      position: options?.position || "top-right",
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  },
  warning: (message: string, options?: ToastOptions) => {
    toastify(message, {
      type: "warning",
      autoClose: options?.duration || 3000,
      position: options?.position || "top-right",
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  },
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider = ({ children }: ToastProviderProps) => {
  return (
    <>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        style={{
          fontFamily: "inherit",
        }}
      />
    </>
  );
};
