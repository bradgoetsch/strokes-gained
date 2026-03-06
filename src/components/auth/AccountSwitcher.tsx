// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { Link } from 'react-router-dom';
import { KeyRound, LogOut, Settings, UserIcon, UserPlus, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { useLoggedInAccounts, type Account } from '@/hooks/useLoggedInAccounts';
import { useNostrLogin } from '@nostrify/react/login';
import { genUserName } from '@/lib/genUserName';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

const LOGIN_TYPE_LABELS: Record<string, string> = {
  extension: 'Extension',
  nsec: 'Private Key',
  bunker: 'Bunker',
};

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { currentUser, otherUsers, setLogin, removeLogin } = useLoggedInAccounts();
  const { logins } = useNostrLogin();

  if (!currentUser) return null;

  const getDisplayName = (account: Account): string => {
    return account.metadata.name ?? genUserName(account.pubkey);
  };

  const loginType = logins[0]?.type ?? 'nsec';
  const loginTypeLabel = LOGIN_TYPE_LABELS[loginType] ?? 'Unknown';

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className='flex items-center gap-2.5 py-1.5 px-2 rounded-full hover:bg-accent transition-all w-full text-foreground'>
          <Avatar className='w-8 h-8 shrink-0'>
            <AvatarImage src={currentUser.metadata.picture} alt={getDisplayName(currentUser)} />
            <AvatarFallback className="golf-gradient text-white text-xs font-bold">
              {getDisplayName(currentUser).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className='flex-1 text-left hidden md:block min-w-0'>
            <p className='font-semibold text-sm truncate leading-tight'>
              {getDisplayName(currentUser)}
            </p>
            <p className='text-[10px] text-muted-foreground leading-tight'>
              {loginTypeLabel}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className='w-64 p-2' align="end">
        {/* Profile header inside dropdown */}
        <div className='flex items-center gap-3 px-2 py-2 mb-1'>
          <Avatar className='w-10 h-10 shrink-0'>
            <AvatarImage src={currentUser.metadata.picture} alt={getDisplayName(currentUser)} />
            <AvatarFallback className="golf-gradient text-white text-sm font-bold">
              {getDisplayName(currentUser).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className='min-w-0 flex-1'>
            <p className='font-semibold text-sm truncate'>{getDisplayName(currentUser)}</p>
            {currentUser.metadata.nip05 && (
              <p className='text-[10px] text-primary truncate'>{currentUser.metadata.nip05}</p>
            )}
            <Badge variant="secondary" className='text-[10px] mt-0.5 h-4 px-1.5'>
              {loginTypeLabel}
            </Badge>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Profile page */}
        <DropdownMenuItem asChild className='flex items-center gap-2 cursor-pointer p-2 rounded-md'>
          <Link to="/profile">
            <User className='w-4 h-4' />
            <span>Profile &amp; Stats</span>
          </Link>
        </DropdownMenuItem>

        {/* Key management — links to Shakespeare settings */}
        <DropdownMenuItem asChild className='flex items-center gap-2 cursor-pointer p-2 rounded-md'>
          <a
            href="https://shakespeare.diy/settings/nostr"
            target="_blank"
            rel="noopener noreferrer"
          >
            <KeyRound className='w-4 h-4' />
            <span>Key Management</span>
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className='flex items-center gap-2 cursor-pointer p-2 rounded-md'>
          <a
            href="https://shakespeare.diy/settings"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Settings className='w-4 h-4' />
            <span>Shakespeare Settings</span>
          </a>
        </DropdownMenuItem>

        {/* Other logged-in accounts */}
        {otherUsers.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1'>
              Switch Account
            </div>
            {otherUsers.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={() => setLogin(user.id)}
                className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
              >
                <Avatar className='w-7 h-7 shrink-0'>
                  <AvatarImage src={user.metadata.picture} alt={getDisplayName(user)} />
                  <AvatarFallback className="text-xs">
                    {getDisplayName(user)?.charAt(0) || <UserIcon className="w-3 h-3" />}
                  </AvatarFallback>
                </Avatar>
                <span className='text-sm truncate flex-1'>{getDisplayName(user)}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onAddAccountClick}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <UserPlus className='w-4 h-4' />
          <span>Add another account</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => removeLogin(currentUser.id)}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-destructive focus:text-destructive'
        >
          <LogOut className='w-4 h-4' />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
