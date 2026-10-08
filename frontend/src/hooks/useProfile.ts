"use client";

import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { safeSetItem } from "@/lib/utils";
import { setAccessToken } from "@/lib/session";
import type { User } from "@/contexts/AuthContext";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<User>) =>
      api.put<User>("/auth/profile", data).then((res) => res.data),
    onSuccess: (data) => {
      safeSetItem("user", JSON.stringify(data));
      queryClient.setQueryData(["auth"], data);
    },
  });
}

interface ChangePasswordResponse {
  /** Re-issued access token for the current session; all other sessions die. */
  accessToken?: string;
  message: string;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api
        .post<ChangePasswordResponse>("/auth/change-password", data)
        .then((res) => res.data),
    onSuccess: (data) => {
      // The password change revokes every session; adopt the re-issued
      // access token so the current one survives. The new refresh token
      // rides the httpOnly cookie the response rewrote.
      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<User>("/auth/profile").then((res) => res.data),
  });
}
