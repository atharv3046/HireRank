import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BriefcaseIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isJobPage = location.pathname.startsWith('/jobs/');

  return (
    <nav className="bg-primary-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <BriefcaseIcon className="h-8 w-8 text-primary-100" />
              <span className="font-bold text-xl tracking-tight text-white">RecruitAI</span>
            </Link>
            
            {user && (
              <div className="hidden md:flex ml-10 space-x-4">
                <Link
                  to="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    !isJobPage ? 'bg-primary-800 text-white' : 'text-primary-100 hover:bg-primary-700'
                  }`}
                >
                  Dashboard
                </Link>
                {isJobPage && (
                  <Link
                    to="/dashboard"
                    className="text-primary-100 hover:bg-primary-700 px-3 py-2 rounded-md text-sm font-medium flex items-center"
                  >
                    &larr; Back to Jobs
                  </Link>
                )}
              </div>
            )}
          </div>

          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-primary-100 hidden sm:block">{user.email}</span>
              <button
                onClick={logout}
                className="flex items-center text-sm font-medium text-primary-100 hover:text-white hover:bg-primary-800 px-3 py-2 rounded-md transition-colors"
              >
                <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-1" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
