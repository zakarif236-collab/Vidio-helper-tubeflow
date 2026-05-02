import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Settings, LogOut, Camera, Loader2 } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { uploadAvatar } from '../services/projectService';
import { updateUserPhotoURL } from '../services/userService';

const UserAvatarMenu = () => {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [localPhotoURL, setLocalPhotoURL] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!user) return null;

  const email = user.email ?? '';
  const photoURL = localPhotoURL ?? user.photoURL;
  const initial = (user.displayName?.[0] || email[0] || '?').toUpperCase();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setAvatarLoading(true);
    try {
      const downloadURL = await uploadAvatar(user.uid, file);
      await updateProfile(user, { photoURL: downloadURL });
      await updateUserPhotoURL(user.uid, downloadURL);
      setLocalPhotoURL(downloadURL);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setAvatarLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-full overflow-hidden border-2 border-emerald-500/50 hover:border-emerald-400 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        aria-label="User menu"
      >
        {avatarLoading ? (
          <span className="w-full h-full flex items-center justify-center bg-emerald-600">
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          </span>
        ) : photoURL ? (
          <img src={photoURL} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-emerald-600 text-white text-sm font-bold">
            {initial}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-700 bg-slate-900 shadow-xl shadow-black/40 py-1 z-[100] animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-2.5 border-b border-slate-700/60">
            <p className="text-xs text-slate-400 truncate">{email}</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <button
            onClick={() => { fileInputRef.current?.click(); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            Change Photo
          </button>

          <button
            onClick={() => { navigate('/'); setOpen(false); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Home className="w-4 h-4 text-emerald-400" />
            Home
          </button>

          <button
            onClick={() => { navigate('/settings'); setOpen(false); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-4 h-4 text-cyan-400" />
            Settings
          </button>

          <div className="border-t border-slate-700/60 mt-1" />

          <button
            onClick={async () => { await signOut(); setOpen(false); navigate('/'); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserAvatarMenu;
