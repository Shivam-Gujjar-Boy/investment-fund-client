import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Menu, X, PlusCircle, Users, Layers, DollarSign, Compass, User, Mail
} from 'lucide-react';
import { CustomWalletButton } from '../../context/CustomWalletButton';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { programId } from '../../types';
import peerfunds from '../../assets/peerfunds.png';

interface UserProfile {
  username: string;
  email: string;
  profileImageUrl: string;
}

export default function Navbar() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const navigate = useNavigate();
  const wallet = useWallet();
  const { connection } = useConnection();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleProfileModal = () => setIsProfileModalOpen(!isProfileModalOpen);

  useEffect(() => {
    const fetchUserCredentials = async () => {
      if (!wallet || !wallet.publicKey) {
        setUserProfile(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const user = wallet.publicKey;
        const [userAccountPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('user'), user.toBuffer()],
          programId
        );

        const userAccountInfo = await connection.getAccountInfo(userAccountPda);
        if (!userAccountInfo) {
          setUserProfile(null);
          return;
        }

        const userBuffer = Buffer.from(userAccountInfo.data);
        const cid = userBuffer.slice(0, 59).toString();
        const metadataUrl = `https://${cid}.ipfs.w3s.link/metadata.json`;
        const imageUrl = `https://${cid}.ipfs.w3s.link/profile.jpg`;

        const metadataResponse = await fetch(metadataUrl);
        if (!metadataResponse.ok) {
          throw new Error(`Failed to fetch metadata: ${metadataResponse.status}`);
        }
        const metadata = await metadataResponse.json();

        const profileResponse = await fetch(imageUrl);
        if (!profileResponse.ok) {
          throw new Error(`Failed to fetch profile image: ${profileResponse.status}`);
        }
        const profileBlob = await profileResponse.blob();
        const profileImageUrl = URL.createObjectURL(profileBlob);

        setUserProfile({
          username: metadata.username,
          email: metadata.email,
          profileImageUrl: profileImageUrl
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        console.error('Error fetching user profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserCredentials();

    return () => {
      if (userProfile?.profileImageUrl) {
        URL.revokeObjectURL(userProfile.profileImageUrl);
      }
    };
  }, [wallet?.publicKey, wallet, connection]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isProfileModalOpen && !(event.target as Element).closest('.profile-modal')) {
        setIsProfileModalOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileModalOpen]);

  const navItemStyle = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 backdrop-blur-md ${
      isActive
        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
        : 'text-gray-300 hover:bg-purple-700 hover:text-white'
    }`;

  return (
    <>
      <nav className="bg-[#151a2d]/70 backdrop-blur-xl border-b border-indigo-800 shadow-md fixed w-full z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-16">
            {/* Left: Brand & Desktop Nav */}
            <div className="flex items-center space-x-6 sm:space-x-10">
              <div onClick={(e) => {
                e.preventDefault();
                navigate('/dashboard');
              }} className='flex justify-center items-center gap-2 cursor-pointer'>
                <img src={peerfunds} alt="PeerFunds" className='w-10 sm:w-12 rounded-full' />
                <h1 className="text-white text-xl sm:text-2xl font-bold tracking-tight">PeerFunds</h1>
              </div>

              <div className="hidden md:flex space-x-3">
                <NavLink to="/dashboard/discover" className={navItemStyle}>
                  <Compass className="w-4 h-4 mr-2" /> Discover
                </NavLink>
                <NavLink to="/dashboard/create" className={navItemStyle}>
                  <PlusCircle className="w-4 h-4 mr-2" /> Create
                </NavLink>
                <NavLink to="/dashboard/join" className={navItemStyle}>
                  <Users className="w-4 h-4 mr-2" /> Join
                </NavLink>
                <NavLink to="/dashboard/funds" className={navItemStyle}>
                  <Layers className="w-4 h-4 mr-2" /> Your Funds
                </NavLink>
                <NavLink to="/dashboard/portfolio" className={navItemStyle}>
                  <DollarSign className="w-4 h-4 mr-2" /> Portfolio
                </NavLink>
              </div>
            </div>

            {/* Right: Profile Image & Wallet */}
            <div className="hidden md:flex items-center gap-3">
              {loading ? (
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 animate-pulse"></div>
              ) : (
                userProfile && (
                  <div className="relative">
                    <button
                      onClick={toggleProfileModal}
                      className="group relative"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-500/50 group-hover:border-purple-400 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-purple-500/25">
                        <img
                          src={userProfile.profileImageUrl}
                          alt={userProfile.username}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2MzY2RjEiLz4KPHBhdGggZD0iTTIwIDIyQzIzLjMxMzcgMjIgMjYgMTkuMzEzNyAyNiAxNkMyNiAxMi42ODYzIDIzLjMxMzcgMTAgMjAgMTBDMTYuNjg2MyAxMCAxNCAxMi42ODYzIDE0IDE2QzE0IDE5LjMxMzcgMTYuNjg2MyAyMiAyMCAyMloiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0zNCAzNEMzNCAyOCAyOCAyNCAyMCAyNEMxMiAyNCA2IDI4IDYgMzRWMzZIMzRWMzRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K';
                          }}
                        />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-[#151a2d] rounded-full"></div>
                    </button>
                  </div>
                )
              )}
              <CustomWalletButton />
            </div>

            {/* Mobile Hamburger */}
            <div className="md:hidden flex items-center gap-2">
              {userProfile && (
                <button
                  onClick={toggleProfileModal}
                  className="w-8 h-8 rounded-full overflow-hidden border-2 border-purple-500/50"
                >
                  <img
                    src={userProfile.profileImageUrl}
                    alt={userProfile.username}
                    className="w-full h-full object-cover"
                  />
                </button>
              )}
              <button
                onClick={toggleMenu}
                className="p-2 rounded-md text-gray-200 hover:text-white hover:bg-purple-800"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden bg-[#1e2440]/90 backdrop-blur-md px-4 pb-4 pt-2 space-y-1 shadow-inner border-t border-indigo-700 z-50">
            <NavLink to="/dashboard/discover" className={navItemStyle} onClick={toggleMenu}>
              <Compass className="w-4 h-4 mr-2" /> Discover
            </NavLink>
            <NavLink to="/dashboard/create" className={navItemStyle} onClick={toggleMenu}>
              <PlusCircle className="w-4 h-4 mr-2" /> Create
            </NavLink>
            <NavLink to="/dashboard/join" className={navItemStyle} onClick={toggleMenu}>
              <Users className="w-4 h-4 mr-2" /> Join
            </NavLink>
            <NavLink to="/dashboard/funds" className={navItemStyle} onClick={toggleMenu}>
              <Layers className="w-4 h-4 mr-2" /> Your Funds
            </NavLink>
            <NavLink to="/dashboard/portfolio" className={navItemStyle} onClick={toggleMenu}>
              <DollarSign className="w-4 h-4 mr-2" /> Portfolio
            </NavLink>
            <div className="pt-2 border-t border-indigo-700/50">
              <CustomWalletButton />
            </div>
          </div>
        )}
      </nav>

      {/* Profile Modal */}
      {isProfileModalOpen && userProfile && (
        <div className="fixed inset-0 z-[60] flex items-start justify-end pt-16 sm:pt-20 pr-2 sm:pr-4">
          <div className="profile-modal bg-[#1e2440]/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 p-4 sm:p-6 w-full max-w-[300px] sm:max-w-[320px] animate-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <div className="w-12 sm:w-16 h-12 sm:h-16 rounded-full overflow-hidden border-3 border-gradient-to-r from-purple-500 to-indigo-500 p-0.5">
                  <div className="w-full h-full rounded-full overflow-hidden bg-[#1e2440]">
                    <img
                      src={userProfile.profileImageUrl}
                      alt={userProfile.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 sm:w-5 h-4 sm:h-5 bg-green-400 border-2 border-[#1e2440] rounded-full"></div>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-1">Profile</h3>
                <p className="text-xs sm:text-sm text-gray-400">Account Details</p>
              </div>
            </div>

            {/* Profile Info */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-purple-900/20 border border-purple-500/20">
                <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Username</p>
                  <p className="text-white font-semibold text-sm sm:text-base">{userProfile.username}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-indigo-900/20 border border-indigo-500/20">
                <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
                  <p className="text-white font-semibold text-sm sm:text-base break-all">{userProfile.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}