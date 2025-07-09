import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import '@solana/wallet-adapter-react-ui/styles.css';
import React, { ChangeEvent, DragEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { PublicKey, TransactionInstruction, SystemProgram, Transaction } from '@solana/web3.js';
import { programId } from '../types';
import { Buffer } from 'buffer';
import { Upload, X, User, Mail, Wallet, Sparkles, Shield, Zap } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../functions/cropImage';
import { CustomWalletButton } from '../context/CustomWalletButton';

interface SignUpData {
  username: string;
  email: string;
  image: File | null;
}

interface FormErrors {
  username?: string;
  email?: string;
  image?: string;
}

export default function Home() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const { connection } = useConnection();
  const { connected } = wallet;
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [signUpData, setSignUpData] = useState<SignUpData>({
    username: '',
    email: '',
    image: null
  });
  const [cid, setCid] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showWalletConnect, setShowWalletConnect] = useState(false);

  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [croppedFileSize, setCroppedFileSize] = useState<string | null>(null);
  const [croppedFileMBExceeded, setCroppedFileMBExceeded] = useState<boolean>(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const checkUserPDA = async () => {
      if (!connected || !wallet || !wallet.publicKey) return;

      const user = wallet.publicKey;
      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), user.toBuffer()],
        programId,
      );

      setLoading(true);

      try {
        const accountInfo = await connection.getAccountInfo(userAccountPda);
        if (accountInfo !== null) {
          console.log("User already exists");
          toast.success('Welcome back! Account found.');
          navigate('/dashboard/create');
        } else {
          console.log("No user account found. Prompting sign-up.");
          setShowSignUpModal(true); // first modal (name, email, image)
        }
      } catch (err) {
        console.error("Error checking user PDA:", err);
        toast.error('Failed to fetch user account!');
      } finally {
        setLoading(false);
      }
    };

    checkUserPDA();
  }, [connected, wallet, connection, navigate]);

  const handleUserAccountCreation = async () => {
    if (!wallet || !wallet.publicKey || !wallet.signTransaction) return;

    setIsCreating(true);
    const user = wallet.publicKey;
    const [userAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('user'), user.toBuffer()],
      programId
    );

    try {
      setLoading(true);

      const instructionTag = 6;
      const cidBytes = Buffer.from(cid, 'utf8');
      const buffer = Buffer.alloc(1 + cidBytes.length);
      let offset = 0;
      buffer.writeUInt8(instructionTag, offset);
      offset += 1;
      cidBytes.copy(buffer, offset);
      const instructionData = buffer;
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: userAccountPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = user;

      const signedTx = await wallet.signTransaction(transaction);
      const txSig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight });

      toast.success(`Welcome ${signUpData.username}! Account created successfully.`);

      // You can now send signUpData to your backend
      console.log('Sign-up completed:', {
        username: signUpData.username,
        email: signUpData.email,
        walletAddress: user.toBase58(),
        image: signUpData.image
      });

      // Reset everything and redirect
      setSignUpData({ username: '', email: '', image: null });
      setImagePreview(null);
      setErrors({});
      navigate('/dashboard/create');
    } catch (err) {
      console.error("Error creating user account:", err);
      toast.error('Error creating account. Please try again.');
    } finally {
      setLoading(false);
    }
    setIsCreating(false);
  };

  const handleInputChange = (field: keyof SignUpData, value: string): void => {
    setSignUpData(prev => ({ ...prev, [field]: value }));
    // Clear specific field error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as keyof FormErrors];
        return newErrors;
      });
    }
  };

  const handleImageUpload = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setSignUpData(prev => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        if (e.target?.result) {
          setImagePreview(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } else {
      toast.error('Please select a valid image file');
    }
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // handleImageUpload(e.target.files[0]);
      const reader = new FileReader();
      reader.onload = () => {
        setTempImage(reader.result as string);
        setCropModalVisible(true);  
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!signUpData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (signUpData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (!signUpData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signUpData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if ((signUpData.image?.size ?? 0) > 512000) {
      newErrors.image = 'Please upload an image of size less than 500kB';
    }
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length !== 0) {
      setModalLoading(false);
      toast.error('Some issues in form data');
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (validateForm()) {
      // Store sign-up data
      const signUpPayload = {
        username: signUpData.username.trim(),
        email: signUpData.email.trim(),
        image: signUpData.image // File object or null
      };
      
      console.log('Sign-up payload:', signUpPayload);

      const formData = new FormData();
      formData.append('username', signUpData.username.trim());
      formData.append('email', signUpData.email.trim());
      if (signUpData.image) {
        formData.append('image', signUpData.image);
      }

      console.log('Request marne wali hai');

      try {
        const res = await fetch('https://investment-fund-server-production.up.railway.app/api/upload/upload-user-data', {
          method: 'POST',
          body: formData
        });

        const result = await res.json();

        if (res.status !== 200) {
          throw new Error(result?.error || 'Failed to upload user data');
        }

        console.log(result);
        setModalLoading(false);

        console.log('✅ Upload success:', result);
        console.log('Success:', result.success);
        console.log('folder cid:', result.folderCid);
        console.log('metadata url:', result.metadataUrl);
        console.log('image url:', result.imageUrl);
        console.log('cid object:', result.cidObject);
        setCid(result.folderCid);
      } catch (err) {
        console.error('❌ Upload failed:', err);
        setModalLoading(false);
        throw err;
      }
      
      // Close sign-up modal and show wallet connect
      setShowSignUpModal(false);
      setShowWalletConnect(true);
      toast.success('Account details saved! Now connect your wallet to complete registration.');
    }
  };

  const WalletConnectModal: React.FC = () => (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowWalletConnect(false);
          setShowSignUpModal(true); // Go back to sign up if they close
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md bg-gradient-to-br from-gray-900 via-purple-900/30 to-gray-900 rounded-3xl border border-purple-500/30 shadow-[0_0_10px_#8b5cf6aa] overflow-hidden">
        
        {/* Close button */}
        <button
          onClick={() => {
            setShowWalletConnect(false);
            setShowSignUpModal(true);
          }}
          className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white transition-colors duration-200 z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
            <p className="text-gray-400">
              Hello <span className="text-purple-400 font-semibold">{signUpData.username}</span>! 
              Connect your wallet to complete your PeerFunds registration.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
              <h3 className="text-white font-medium mb-2">Account Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Username:</span>
                  <span className="text-white">{signUpData.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Email:</span>
                  <span className="text-white">{signUpData.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Profile Image:</span>
                  <span className="text-white">{signUpData.image ? 'Uploaded' : 'None'}</span>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => {
                  setIsCreating(true);
                  handleUserAccountCreation();
                }}
                disabled={isCreating}
                className={`border px-3 py-2 rounded-xl w-full h-12 ${
                  isCreating ?
                  'bg-gray-800 hover:bg-gray-600 cursor-not-allowed' :
                  'bg-indigo-800 hover:bg-indigo-600'
                }`}>
                {isCreating ? 'Creating...' : 'Create Account'}
              </button>
            </div>

            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <Shield className="w-4 h-4" />
              <span>Your wallet will be securely connected to complete registration</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-700">
            <button
              onClick={() => {
                setShowWalletConnect(false);
                setShowSignUpModal(true);
              }}
              className="text-gray-400 hover:text-white text-sm transition-colors duration-200"
            >
              ← Back to account details
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-white text-lg">Preparing your dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          <style>{`
            @keyframes float {
              0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0; }
              50% { transform: translateY(-20px) rotate(180deg); opacity: 1; }
            }
            .animate-float {
              animation: float 6s ease-in-out infinite;
            }
            .animation-delay-1000 {
              animation-delay: 1s;
            }
            .animation-delay-2000 {
              animation-delay: 2s;
            }
            .bg-gradient-radial {
              background: radial-gradient(circle, var(--tw-gradient-stops));
            }
            @keyframes glow {
              0%, 100% { box-shadow: 0 0 5px rgba(139, 92, 246, 0.5); }
              50% { box-shadow: 0 0 10px rgba(139, 92, 246, 0.8); }
            }
            .animate-glow {
              animation: glow 3s ease-in-out infinite;
            }
            @keyframes slideInUp {
              from { transform: translateY(50px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            .animate-slideInUp {
              animation: slideInUp 0.8s ease-out forwards;
            }
            @keyframes fadeInScale {
              from { transform: scale(0.8); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            .animate-fadeInScale {
              animation: fadeInScale 1s ease-out forwards;
            }
            .animate-textGlow {
              animation: textGlow 3s ease-in-out infinite;
            }
          `}</style>

          <header className="relative z-10 pt-6 px-4 sm:px-6 lg:px-8 animate-slideInUp">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <h1 className="text-xl sm:text-4xl font-bold text-white hover:text-purple-400 transition-colors duration-300">
                PeerFunds
              </h1>
              <div className="hidden sm:block">
                <CustomWalletButton />
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-8 lg:px-16 py-10 relative z-10 mt-16">
            <div className="max-w-6xl mx-auto">
              {/* Hero Section */}
              <section className="text-center mb-32 animate-fadeInScale flex flex-col items-center">
                <div className="relative">
                  <h1 className="text-6xl sm:text-8xl font-bold text-white mb-8 animate-textGlow">
                    Decentralized{' '}
                    <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent animate-pulse">
                      Investment Funds
                    </span>
                  </h1>
                  <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-to-r from-purple-500/20 to-violet-500/20 rounded-full blur-xl animate-pulse"></div>
                  <div className="absolute -bottom-10 -left-10 w-16 h-16 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-full blur-xl animate-pulse animation-delay-1000"></div>
                </div>
                <p className="text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed mb-12 animate-slideInUp">
                  Create and manage <span className="text-purple-400 font-semibold">trustless investment funds</span> on the Solana blockchain. 
                  Join forces with friends, colleagues or communities in the <span className="text-violet-400 font-semibold">decentralized future</span>.
                </p>
            <div className="mt-12 animate-slideInUp">
              <div className="inline-block relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-violet-600/20 to-indigo-600/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative bg-gray-800/30 backdrop-blur-sm border border-purple-500/30 rounded-full p-2 hover:border-purple-400/50 hover:bg-gray-800/50 transition-all duration-300">
                  <CustomWalletButton />
                </div>
              </div>
            </div>
              </section>

              {/* Features Grid */}
              <section className="mb-32">
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {[
                    {
                      title: 'Create a Fund',
                      description: 'Start a DAO-style fund and set governance rules.',
                      icon: '🚀',
                      gradient: 'from-purple-600 to-indigo-600',
                    },
                    {
                      title: 'Join Together',
                      description: 'Collaboratively pool resources for smarter investing.',
                      icon: '🤝',
                      gradient: 'from-violet-600 to-purple-600',
                    },
                    {
                      title: 'Invest Together',
                      description: 'Invest through decentralized proposals on-chain!',
                      icon: '💎',
                      gradient: 'from-indigo-600 to-blue-600',
                    },
                    {
                      title: 'Grow Together',
                      description: 'See returns, PnL, and distribute profits fairly.',
                      icon: '📈',
                      gradient: 'from-purple-600 to-violet-600',
                    }
                  ].map((item, i) => (
                    <div 
                      key={i} 
                      className="group relative bg-gray-800/20 backdrop-blur-xl rounded-3xl p-8 text-center border border-gray-700/30 hover:border-purple-500/50 hover:shadow-[0_0_40px_#8b5cf622] hover:scale-105 transition-all duration-500"
                      // style={{ animationDelay: `${i * 0.2}s` }}
                    >
                      {/* <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-violet-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div> */}
                      <div className="relative z-10">
                        <div className={`w-16 h-16 bg-gradient-to-r ${item.gradient} rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 animate-glow`}>
                          {item.icon}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-4 group-hover:text-purple-300 transition-colors duration-300">{item.title}</h3>
                        <p className="text-gray-400 group-hover:text-gray-300 transition-colors duration-300">{item.description}</p>
                      </div>
                      {/* <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div> */}
                    </div>
                  ))}
                </div>
              </section>

              {/* Why PeerFunds Section */}
              <section className="mb-32 grid md:grid-cols-2 gap-16 items-center">
                <div className="space-y-8 animate-slideInUp">
                  <h2 className="text-5xl font-bold text-white mb-6 animate-textGlow">
                    Why <span className="text-purple-400">PeerFunds</span>?
                  </h2>
                  <p className="text-xl text-gray-300 leading-relaxed">
                    Whether you're a solo crypto trader or a team of enthusiastic friends, PeerFunds empowers you to invest with 
                    <span className="text-purple-400 font-semibold"> trustless collaboration</span>.
                    On-chain governance, proposal voting, and fund transparency ensure every decision is made fairly.
                  </p>
                  <div className="space-y-6">
                    {[
                      { icon: Shield, text: 'Trustless voting system', color: 'text-purple-400' },
                      { icon: Zap, text: 'Performance analytics and portfolio insights', color: 'text-violet-400' },
                      { icon: Sparkles, text: 'Learn by joining funds, even with minimal risk', color: 'text-indigo-400' }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center space-x-4 group hover:scale-105 transition-all duration-300">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-600/20 to-violet-600/20 rounded-xl flex items-center justify-center group-hover:bg-gradient-to-r group-hover:from-purple-600/40 group-hover:to-violet-600/40 transition-all duration-300">
                          <item.icon className={`w-6 h-6 ${item.color} group-hover:scale-110 transition-transform duration-300`} />
                        </div>
                        <span className="text-lg text-gray-300 group-hover:text-white transition-colors duration-300">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="relative h-80 animate-fadeInScale">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-indigo-900/30 to-gray-900/30 rounded-3xl border border-purple-500/30 backdrop-blur-xl flex items-center justify-center overflow-hidden group hover:scale-105 transition-transform duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-violet-500/10 animate-pulse"></div>
                    <div className="text-center relative z-10">
                      <div className="w-24 h-24 bg-gradient-to-r from-purple-500/20 to-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-glow">
                        <Shield className="w-12 h-12 text-purple-300 animate-pulse" />
                      </div>
                      <p className="text-lg text-purple-300 font-semibold">Secure & Transparent</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Learning Section */}
              <section className="mb-32 grid md:grid-cols-2 gap-16 items-center">
                <div className="relative h-80 animate-fadeInScale">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-900/30 via-purple-900/30 to-gray-900/30 rounded-3xl border border-violet-500/30 backdrop-blur-xl flex items-center justify-center overflow-hidden group hover:scale-105 transition-transform duration-500">
                    <div className="absolute inset-0 bg-gradient-to-l from-violet-500/10 via-transparent to-purple-500/10 animate-pulse"></div>
                    <div className="text-center relative z-10">
                      <div className="w-24 h-24 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-glow">
                        <User className="w-12 h-12 text-violet-300 animate-pulse" />
                      </div>
                      <p className="text-lg text-violet-300 font-semibold">Learn & Grow</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-8 animate-slideInUp">
                  <h2 className="text-5xl font-bold text-white mb-6 animate-textGlow">
                    Not Just Investing – It's <span className="text-violet-400">Learning</span>
                  </h2>
                  <p className="text-xl text-gray-300 leading-relaxed">
                    Beginners can join public funds, learn how proposals work, and participate in governance without affecting real fund outcomes.
                    <span className="text-violet-400 font-semibold"> Small voting powers</span> ensure minimal risk, while real-time engagement drives 
                    <span className="text-purple-400 font-semibold"> crypto knowledge growth</span>.
                  </p>
                  <div className="space-y-6">
                    {[
                      { icon: Zap, text: 'Proposals with real-time outcomes', color: 'text-violet-400' },
                      { icon: Sparkles, text: 'PnL dashboards, voting analytics, and educational feedback', color: 'text-purple-400' },
                      { icon: Shield, text: 'Learn by doing — not just reading', color: 'text-indigo-400' }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center space-x-4 group hover:scale-105 transition-all duration-300">
                        <div className="w-12 h-12 bg-gradient-to-r from-violet-600/20 to-purple-600/20 rounded-xl flex items-center justify-center group-hover:bg-gradient-to-r group-hover:from-violet-600/40 group-hover:to-purple-600/40 transition-all duration-300">
                          <item.icon className={`w-6 h-6 ${item.color} group-hover:scale-110 transition-transform duration-300`} />
                        </div>
                        <span className="text-lg text-gray-300 group-hover:text-white transition-colors duration-300">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section className="text-center mb-16 animate-fadeInScale">
                <div className="relative">
                  <h2 className="text-5xl font-bold text-white mb-6 animate-textGlow">
                    Ready to Join the Future of <span className="text-purple-400">Community Investing</span>?
                  </h2>
                  <div className="absolute -top-5 -right-5 w-16 h-16 bg-gradient-to-r from-purple-500/20 to-violet-500/20 rounded-full blur-xl animate-pulse"></div>
                  <div className="absolute -bottom-5 -left-5 w-12 h-12 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-full blur-xl animate-pulse animation-delay-1000"></div>
                </div>
                <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed">
                  Connect your wallet and dive into the world of <span className="text-purple-400 font-semibold">decentralized fund management</span>. 
                  It takes just a few seconds to get started on your <span className="text-violet-400 font-semibold">DeFi journey</span>.
                </p>
                <div className="inline-block transform hover:scale-110 transition-transform duration-300">
                  <CustomWalletButton />
                </div>
              </section>
            </div>
          </main>

          {/* Footer */}
          <footer className="relative z-10 py-12 text-center text-gray-500 border-t border-gray-800/50 backdrop-blur-sm">
            <div className="max-w-6xl mx-auto px-4">
              <p className="text-lg mb-3 hover:text-purple-400 transition-colors duration-300">
                Powered by <span className="font-semibold text-purple-400">Solana Blockchain</span>
              </p>
              <p className="text-sm opacity-75">
                Building the future of decentralized finance, one fund at a time.
              </p>
            </div>
          </footer>
        </>
      )}
      {showSignUpModal && (
        modalLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className='relative w-full max-w-md bg-gradient-to-br from-gray-900 via-purple-900/30 to-gray-900 rounded-3xl border border-purple-500/30 shadow-[0_0_10px_#8b5cf6aa] overflow-hidden flex flex-col justify-center items-center h-[92%]'>
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-purple-500 animate-spin" />
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-500/20 via-purple-700/20 to-purple-500/20 blur-md" />
            </div>
            <div className="mt-4 text-sm text-gray-400 tracking-wide">Uploading to IPFS...</div>
          </div>
        </div>
        ) : (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowSignUpModal(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
            <div className="relative w-full max-w-md bg-gradient-to-br from-gray-900 via-purple-900/30 to-gray-900 rounded-3xl border border-purple-500/30 shadow-[0_0_10px_#8b5cf6aa] overflow-hidden">
              
              {/* Close button */}
              <button
                onClick={() => {
                  setShowSignUpModal(false);
                  setSignUpData({ username: '', email: '', image: null });
                  setImagePreview(null);
                  setErrors({});
                }}
                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white transition-colors duration-200 z-10"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative p-8">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Join PeerFunds</h2>
                  <p className="text-gray-400">Create your account to get started</p>
                </div>

                {/* Form */}
                <div className="space-y-6">
                  {/* Username */}
                  <div className="space-y-2">
                    <label htmlFor='fundName' className="block text-sm font-medium text-gray-300">
                      Username <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        // id="userName"
                        value={signUpData.username}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange('username', e.target.value)}
                        // onChange={(e) => setUserName(e.target.value)}
                        maxLength={16}
                        className={`w-full pl-12 pr-4 py-3 bg-gray-800/50 border ${
                          errors.username ? 'border-red-500' : 'border-gray-600'
                        } rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200`}
                        placeholder="Choose your handle"
                      />
                    </div>
                    {errors.username && (
                      <p className="text-red-400 text-xs mt-1">{errors.username}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={signUpData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="your@email.com"
                        className={`w-full pl-12 pr-4 py-3 bg-gray-800/50 border ${
                          errors.email ? 'border-red-500' : 'border-gray-600'
                        } rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-400 text-xs mt-1">{errors.email}</p>
                    )}
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-2 flex flex-col">
                    <label className="block text-sm font-medium text-gray-300">
                      Profile Image <span className="text-gray-500">(optional)</span>
                    </label>
                    
                    {imagePreview ? (
                      <div className="relative w-full max-w-xs">
                        <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-gray-600 bg-gray-800">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => {
                              setImagePreview(null);
                              setSignUpData(prev => ({ ...prev, image: null }));
                              setCroppedFileSize(null);
                              setCroppedFileMBExceeded(false);
                            }}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs shadow-md transition duration-150"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="mt-2 text-xs text-gray-400 space-y-1">
                          <div>
                            <span className="font-medium text-white">Size:</span> {croppedFileSize}
                          </div>
                        </div>

                        {croppedFileMBExceeded && (
                          <div className="mt-1 text-xs text-red-400 border border-red-500 bg-red-500/10 rounded-md px-3 py-1">
                            ⚠️ Image size exceeds 500KB. Consider cropping tighter or uploading a smaller image.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={`relative w-full h-32 border-2 border-dashed ${
                          dragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600'
                        } rounded-xl transition-all duration-200 hover:border-purple-500 hover:bg-purple-500/5 cursor-pointer group`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileInputChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 group-hover:text-purple-400 transition-colors duration-200">
                          <Upload className="w-8 h-8 mb-2" />
                          <p className="text-sm font-medium">Drop image here or click to upload</p>
                          <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 space-y-3">
                  <button
                    onClick={() => {
                      setModalLoading(true);
                      handleSignUp();
                    }}
                    className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-[0_0_20px_#8b5cf6aa] transition-all duration-300 hover:scale-[1.02] border border-purple-500/30 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-violet-600/20 to-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative flex items-center justify-center space-x-2">
                      <Zap className="w-5 h-5" />
                      <span>Create Account</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  </button>
                </div>

                <p className="text-center text-xs text-gray-500 mt-6">
                  By signing up, you agree to our terms and embrace the decentralized future
                </p>
              </div>
            </div>
          </div>
        )
      )}
      {showWalletConnect && <WalletConnectModal />}
      {cropModalVisible && tempImage && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="bg-gray-900 p-4 rounded-xl w-[90vw] max-w-md relative">
            <div className="relative w-full h-64">
              <Cropper
                image={tempImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, cropped) => setCroppedAreaPixels(cropped)}
              />
            </div>
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => setCropModalVisible(false)}
                className="px-4 py-2 text-sm bg-gray-700 text-white rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const blob = await getCroppedImg(tempImage, croppedAreaPixels);
                  const previewUrl = URL.createObjectURL(blob);
                  const file = new File([blob], 'cropped.jpg');

                  const sizeInKB = file.size / 1024;
                  const sizeInMB = sizeInKB / 1024;
                  const formattedSize = sizeInMB >= 1 ? `${sizeInMB.toFixed(2)} MB` : `${sizeInKB.toFixed(2)} KB`;


                  setSignUpData(prev => ({ ...prev, image: new File([blob], 'cropped.jpg') }));
                  setImagePreview(previewUrl);
                  setCroppedFileSize(formattedSize);
                  setCroppedFileMBExceeded(file.size > 512000);
                  setCropModalVisible(false);
                }}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-500"
              >
                Crop & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}