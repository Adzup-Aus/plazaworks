import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Role } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export type PermissionInfo = {
  key: string;
  displayName: string;
  description: string;
  category: string;
};

export type PermissionsResponse = {
  permissions: PermissionInfo[];
  categories: string[];
};

export function useRoles() {
  return useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; description?: string }) => {
      const res = await apiRequest("POST", "/api/roles", body);
      return res.json() as Promise<Role>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/roles"] });
    },
  });
}

export function useAvailablePermissions() {
  return useQuery<PermissionsResponse>({
    queryKey: ["/api/permissions"],
  });
}

export function useRolePermissions(roleId: string | null) {
  return useQuery<{ roleId: string; permissions: string[] }>({
    queryKey: roleId ? ["/api/roles", roleId, "permissions"] : [],
    enabled: !!roleId,
  });
}

export function useSetRolePermissions(roleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (permissions: string[]) => {
      const res = await apiRequest("PUT", `/api/roles/${roleId}/permissions`, { permissions });
      return res.json() as Promise<{ roleId: string; permissions: string[] }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/roles", roleId, "permissions"] });
      qc.invalidateQueries({ queryKey: ["/api/roles"] });
    },
  });
}

export function useRole(roleId: string | null) {
  return useQuery<Role>({
    queryKey: roleId ? ["/api/roles", roleId] : [],
    enabled: !!roleId,
  });
}

export function useUpdateRole(roleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name?: string; description?: string }) => {
      const res = await apiRequest("PATCH", `/api/roles/${roleId}`, body);
      return res.json() as Promise<Role>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/roles"] });
      qc.invalidateQueries({ queryKey: ["/api/roles", roleId] });
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (roleId: string) => {
      await apiRequest("DELETE", `/api/roles/${roleId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/roles"] });
    },
  });
}
