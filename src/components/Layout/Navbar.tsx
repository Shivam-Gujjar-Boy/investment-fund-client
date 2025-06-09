import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Menu, X, PlusCircle, Users, Layers, DollarSign, Compass
} from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const navItemStyle = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 backdrop-blur-md ${
      isActive
        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
        : 'text-gray-300 hover:bg-purple-700 hover:text-white'
    }`;

  return (
    <nav className="bg-[#151a2d]/70 backdrop-blur-xl border-b border-indigo-800 shadow-md fixed w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand & Desktop Nav */}
          <div className="flex items-center space-x-10">
            <h1 className="text-white text-2xl font-bold tracking-tight">🚀 PeerFunds</h1>

            <div className="hidden md:flex space-x-2">
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

          {/* Right: Wallet */}
          <div className="hidden md:flex items-center">
            <WalletMultiButton className="!bg-indigo-600 hover:!bg-purple-700 transition-all !rounded-xl !text-white font-medium shadow-lg" />
          </div>

          {/* Mobile Hamburger */}
          <div className="md:hidden">
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
        <div className="md:hidden bg-[#1e2440]/90 backdrop-blur-md px-4 pb-4 pt-2 space-y-2 shadow-inner border-t border-indigo-700">
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
          <button
            onClick={() => {
              navigate('/');
              toggleMenu();
            }}
            className="w-full flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-red-400 hover:text-white hover:bg-red-700 transition-all"
          >
            ❌ Disconnect
          </button>
        </div>
      )}
    </nav>
  );
}
