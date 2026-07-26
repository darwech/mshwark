"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/*
  نظام Modal موحّد بيحل محل alert() / confirm() / prompt() الأصليين بتوع
  النظام (اللي بتاعتهم شكل رمادي/أبيض غريب ومش بيتحكم فيه CSS التطبيق خالص).

  الاستخدام في أي كومبوننت:
    const dialog = useDialog();
    await dialog.alert("رسالة");
    const ok = await dialog.confirm("متأكد؟");
    const val = await dialog.prompt("اكتب السعر", { numeric: true });

  مهم: أي كومبوننت بيستخدم useDialog() لازم يكون جوه <DialogProvider> —
  وده متحقق أصلاً لأن DialogProvider بيلف كل صفحة Home من فوق.
*/

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (dialog?.type === "prompt" && inputRef.current) {
      // نفتح الكيبورد تلقائيًا لما الفورم يظهر
      const timer = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [dialog]);

  const close = useCallback((result) => {
    setDialog((current) => {
      if (current) current.resolve(result);
      return null;
    });
  }, []);

  const alert = useCallback((message) => {
    return new Promise((resolve) => {
      setDialog({ type: "alert", message, resolve });
    });
  }, []);

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      setDialog({ type: "confirm", message, resolve });
    });
  }, []);

  // options: { defaultValue, numeric, placeholder }
  const prompt = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setInputValue(
        options.defaultValue != null ? String(options.defaultValue) : "",
      );

      setDialog({
        type: "prompt",
        message,
        numeric: Boolean(options.numeric),
        placeholder: options.placeholder || "",
        resolve,
      });
    });
  }, []);

  function handleInputChange(e) {
    const raw = e.target.value;

    if (dialog?.numeric) {
      // نسمح بالأرقام ونقطة عشرية واحدة بس (زي 40 أو 40.5)
      let cleaned = raw.replace(/[^0-9.]/g, "");

      const firstDot = cleaned.indexOf(".");

      if (firstDot !== -1) {
        cleaned =
          cleaned.slice(0, firstDot + 1) +
          cleaned.slice(firstDot + 1).replace(/\./g, "");
      }

      setInputValue(cleaned);
      return;
    }

    setInputValue(raw);
  }

  function submitPrompt(e) {
    e.preventDefault();

    const trimmed = inputValue.trim();

    close(trimmed === "" ? "" : trimmed);
  }

  if (!dialog) {
    return (
      <DialogContext.Provider value={{ alert, confirm, prompt }}>
        {children}
      </DialogContext.Provider>
    );
  }

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}

      <div className="overlay appDialogOverlay">
        <div className="modal appDialogModal">
          <p className="appDialogMessage">{dialog.message}</p>

          {dialog.type === "prompt" && (
            <form onSubmit={submitPrompt}>
              <input
                ref={inputRef}
                type={dialog.numeric ? "tel" : "text"}
                inputMode={dialog.numeric ? "numeric" : "text"}
                pattern={dialog.numeric ? "[0-9]*" : undefined}
                placeholder={dialog.placeholder}
                value={inputValue}
                onChange={handleInputChange}
              />

              <div className="actions">
                <button type="submit" className="primary">
                  تأكيد
                </button>

                <button
                  type="button"
                  className="ghost"
                  onClick={() => close(null)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}

          {dialog.type === "confirm" && (
            <div className="actions">
              <button className="accept" onClick={() => close(true)}>
                تأكيد
              </button>

              <button className="reject" onClick={() => close(false)}>
                إلغاء
              </button>
            </div>
          )}

          {dialog.type === "alert" && (
            <button className="primary" onClick={() => close(true)}>
              حسنًا
            </button>
          )}
        </div>
      </div>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);

  if (!ctx) {
    throw new Error("useDialog لازم يتستخدم جوه DialogProvider");
  }

  return ctx;
}