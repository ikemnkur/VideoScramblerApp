/**
 * SubscriptionPlans.jsx - redirects to /plans
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SubscriptionPlans = () => {
  const navigate = useNavigate();
  useEffect(() => { navigate('/plans', { replace: true }); }, [navigate]);
  return null;
};

export default SubscriptionPlans;
