import type { ComponentProps } from "react";
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

const navigation = createNavigation(routing);
const NavigationLink = navigation.Link;
type NavigationLinkProps = ComponentProps<typeof NavigationLink>;

export function Link(props: NavigationLinkProps) {
  return <NavigationLink transitionTypes={["forward"]} {...props} />;
}

export const { redirect, usePathname, useRouter, getPathname } = navigation;
