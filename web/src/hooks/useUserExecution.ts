import { useQuery } from "@tanstack/react-query";
import { fetchMyExecution, type UserExecutionSetting } from "@/lib/runnersApi";

export function useUserExecution() {
  return useQuery<UserExecutionSetting | null>({
    queryKey: ["user-execution-me"],
    queryFn: () => fetchMyExecution(),
    staleTime: 60_000,
  });
}
