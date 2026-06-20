import { createFileRoute } from "@tanstack/react-router";
import { api } from "#/lib/api";

export const Route = createFileRoute("/")({
  component: App,
  loader: async () => {
    try {
      const response = await api.health.get();
      return {
        data: response.data,
      };
    } catch (error) {
      console.error(error);
      return {
        status: "error",
        message: "Failed to fetch health",
      };
    }
  },
});

function App() {
  const { data } = Route.useLoaderData();
  console.log(data);
  return <main className="page-wrap px-4 pb-8 pt-14"></main>;
}
