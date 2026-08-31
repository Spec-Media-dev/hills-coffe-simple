import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hills Coffee",
    short_name: "Hills",
    description: "Green coffee offer access from Egypt and Dubai.",
    start_url: "/",
    display: "standalone",
    background_color: "#EEE4D1",
    theme_color: "#173C32",
  };
}
