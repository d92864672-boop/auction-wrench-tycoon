// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  getSession: vi.fn(),
  signInWithGoogle: vi.fn(),
  fetchGoogleStatus: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: mocks.signUp,
      signInWithOtp: mocks.signInWithOtp,
      verifyOtp: mocks.verifyOtp,
      updateUser: mocks.updateUser,
      getSession: mocks.getSession,
    },
  },
}));

vi.mock("@/lib/google-auth", () => ({
  fetchGoogleStatus: mocks.fetchGoogleStatus,
  signInWithGoogle: mocks.signInWithGoogle,
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

// Страница использует навигацию роутера и Link, но для теста достаточно заглушек.
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  useNavigate: () => () => {},
  Link: ({ children }: { children?: unknown }) => children,
}));

import { Route } from "@/routes/auth";

const AuthPage = (Route as unknown as { component: ComponentType }).component;
const field = (container: HTMLElement, selector: string) => container.querySelector(selector) as HTMLInputElement;

describe("Вход в игру", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.fetchGoogleStatus.mockResolvedValue({ available: false, reason: "Google не включён" });
    mocks.signUp.mockResolvedValue({ error: null });
    mocks.signInWithOtp.mockResolvedValue({ error: null });
  });

  it("после отправки открывает шаг с кодом из письма", async () => {
    const { container } = render(<AuthPage />);

    fireEvent.change(field(container, 'input[type="email"]'), { target: { value: "player@wert.ru" } });
    fireEvent.change(field(container, 'input[type="password"]'), { target: { value: "Wq7-Rt9-mZ4-kLp2" } });
    fireEvent.click(screen.getByRole("button", { name: /Получить код на почту/ }));

    await waitFor(() => expect(mocks.signInWithOtp).toHaveBeenCalledTimes(1));
    expect(mocks.signInWithOtp.mock.calls[0][0]).toMatchObject({ email: "player@wert.ru" });
    // Письмо с кодом уходит сразу: регистрация и пароль — уже после кода.
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();

    expect(await screen.findByText(/Код из письма/)).toBeTruthy();
    expect(container.querySelector('input[inputmode="numeric"]')).toBeTruthy();
  });

  it("проверяет код и пускает в игру", async () => {
    const { container } = render(<AuthPage />);

    fireEvent.change(field(container, 'input[type="email"]'), { target: { value: "player@wert.ru" } });
    fireEvent.change(field(container, 'input[type="password"]'), { target: { value: "Wq7-Rt9-mZ4-kLp2" } });
    fireEvent.click(screen.getByRole("button", { name: /Получить код на почту/ }));
    await screen.findByText(/Код из письма/);

    fireEvent.change(field(container, 'input[inputmode="numeric"]'), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /^Войти$/ }));

    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledTimes(1));
    expect(mocks.verifyOtp.mock.calls[0][0]).toMatchObject({ email: "player@wert.ru", token: "123456", type: "email" });
    // Пароль применяется после подтверждения кодом: им можно войти без кода.
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ password: "Wq7-Rt9-mZ4-kLp2" }));
  });

  it("не отправляет код на некорректную почту", async () => {
    const { container } = render(<AuthPage />);

    // Валиден для type="email", но без домена верхнего уровня — приложение такое не примет.
    fireEvent.change(field(container, 'input[type="email"]'), { target: { value: "player@wert" } });
    fireEvent.click(screen.getByRole("button", { name: /Получить код на почту/ }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Введи корректную почту"));
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("показывает кнопку входа через Google", () => {
    render(<AuthPage />);

    expect(screen.getByRole("button", { name: /Продолжить с Google/ })).toBeTruthy();
  });
});
