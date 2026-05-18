import { LogOut, Menu, Moon, Settings, Sun, UserCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/use-theme";
import type { RepoConfig, SignedInUser } from "@/types";

interface TopBarProps {
  repo: RepoConfig;
  user: SignedInUser;
  onOpenNav: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
}

export function TopBar({
  repo,
  user,
  onOpenNav,
  onOpenSettings,
  onOpenProfile,
  onSignOut,
}: TopBarProps): JSX.Element {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenNav}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-gradient text-[11px] font-bold tracking-tight text-white shadow-sm">
            c
          </span>
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight">4wd</span>
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {repo.owner}/{repo.name}
            </span>
          </div>
          {repo.fourWdDisabled ? (
            <Badge variant="failed" className="ml-1">
              KILL SWITCH ON
            </Badge>
          ) : (
            <Badge variant="merged" className="ml-1 hidden md:inline-flex">
              live
            </Badge>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 gap-2 rounded-full px-1.5 pr-3"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user.avatarUrl} alt={user.login} />
                  <AvatarFallback>
                    {user.login.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">
                  {user.login}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onOpenProfile}>
                <UserCircle2 className="h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenSettings}>
                <Settings className="h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onSignOut}>
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
