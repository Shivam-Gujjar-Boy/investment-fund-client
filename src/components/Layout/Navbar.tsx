import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, PlusCircle, Users, Layers, DollarSign, Compass } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();


  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);


  const handleDisconnect = () => {
    navigate('/');
  };

  return (
    <nav className="bg-gradient-to-r from-purple-900 to-indigo-800 fixed w-full z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-white text-xl font-bold">PeerFunds</h1>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <NavLink 
                  to="/dashboard/discover"
                  className={({isActive}) => 
                    `px-3 py-2 rounded-md text-sm font-medium ${
                      isActive 
                        ? 'bg-indigo-700 text-white' 
                        : 'text-gray-200 hover:bg-indigo-600 hover:text-white'
                    } transition-colors duration-200 flex items-center`
                  }
                >
                  <Compass className="w-4 h-4 mr-2" />
                  Discover
                </NavLink>
                <NavLink 
                  to="/dashboard/create"
                  className={({isActive}) => 
                    `px-3 py-2 rounded-md text-sm font-medium ${
                      isActive 
                        ? 'bg-indigo-700 text-white' 
                        : 'text-gray-200 hover:bg-indigo-600 hover:text-white'
                    } transition-colors duration-200 flex items-center`
                  }
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create
                </NavLink>
                <NavLink 
                  to="/dashboard/join"
                  className={({isActive}) => 
                    `px-3 py-2 rounded-md text-sm font-medium ${
                      isActive 
                        ? 'bg-indigo-700 text-white' 
                        : 'text-gray-200 hover:bg-indigo-600 hover:text-white'
                    } transition-colors duration-200 flex items-center`
                  }
                >
                  <Users className="w-4 h-4 mr-2" />
                  Join
                </NavLink>
                <NavLink 
                  to="/dashboard/funds"
                  className={({isActive}) => 
                    `px-3 py-2 rounded-md text-sm font-medium ${
                      isActive 
                        ? 'bg-indigo-700 text-white' 
                        : 'text-gray-200 hover:bg-indigo-600 hover:text-white'
                    } transition-colors duration-200 flex items-center`
                  }
                >
                  <Layers className="w-4 h-4 mr-2" />
                  Your Funds
                </NavLink>
                <NavLink 
                  to="/dashboard/portfolio"
                  className={({isActive}) => 
                    `px-3 py-2 rounded-md text-sm font-medium ${
                      isActive 
                        ? 'bg-indigo-700 text-white' 
                        : 'text-gray-200 hover:bg-indigo-600 hover:text-white'
                    } transition-colors duration-200 flex items-center`
                  }
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Portfolio
                </NavLink>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
                <WalletMultiButton />
            </div>
          </div>
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={toggleMenu}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-200 hover:text-white hover:bg-indigo-600 focus:outline-none"
              aria-controls="mobile-menu"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-indigo-800">
            <NavLink
              to="/dashboard/create"
              className={({isActive}) => 
                `block px-3 py-2 rounded-md text-base font-medium ${
                  isActive 
                    ? 'bg-indigo-700 text-white' 
                    : 'text-gray-200 hover:bg-indigo-600 hover:text-white'
                } transition-colors duration-200 flex items-center`
              }
              onClick={toggleMenu}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Create
            </NavLink>
            <NavLink
              to="/dashboard/join"
              className={({isActive}) => 
                `block px-3 py-2 rounded-md text-base font-medium ${
                  isActive 
                    ? 'bg-indigo-700 text-white' 
                    : 'text-gray-200 hover:bg-indigo-600 hover:text-white'
                } transition-colors duration-200 flex items-center`
              }
              onClick={toggleMenu}
            >
              <Users className="w-4 h-4 mr-2" />
              Join
            </NavLink>
            <NavLink
              to="/dashboard/funds"
              className={({isActive}) => 
                `block px-3 py-2 rounded-md text-base font-medium ${
                  isActive 
                    ? 'bg-indigo-700 text-white' 
                    : 'text-gray-200 hover:bg-indigo-600 hover:text-white'
                } transition-colors duration-200 flex items-center`
              }
              onClick={toggleMenu}
            >
              <Layers className="w-4 h-4 mr-2" />
              Your Funds
            </NavLink>
            <button
              className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:bg-indigo-600 hover:text-white"
              onClick={() => {
                handleDisconnect();
                toggleMenu();
              }}
            >
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}