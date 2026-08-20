import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import UsersCompatibilityPage from "./page";

describe("users compatibility route", () => {
  it("redirects legacy bookmarks to Team & Access", () => {
    UsersCompatibilityPage();

    expect(redirectMock).toHaveBeenCalledWith("/settings/team");
  });
});
