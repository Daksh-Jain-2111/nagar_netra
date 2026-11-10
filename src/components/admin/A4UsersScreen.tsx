import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserProfile, UserRole } from '../../types';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  ShieldCheck, 
  Key, 
  RefreshCw, 
  Calendar,
  Building2,
  AlertTriangle
} from 'lucide-react';

export const A4UsersScreen: React.FC = () => {
  const { 
    users, 
    officerJoinRequests, 
    approveOfficerJoin, 
    declineOfficerJoin, 
    adminInviteUser, 
    regenerateUserInvite, 
    toggleUserDisabled,
    toggleOfficerLeave,
    orgUnits 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'USERS' | 'JOIN_REQUESTS'>('USERS');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Invite form state
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteContact, setInviteContact] = useState<string>('');
  const [inviteUnitId, setInviteUnitId] = useState<string>(orgUnits[0]?.id || '');
  const [inviteRoleTitle, setInviteRoleTitle] = useState<string>('Junior Engineer (Roads)');
  const [inviteRole, setInviteRole] = useState<'supervisor' | 'helpdesk'>('supervisor');
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);

  const pendingRequests = officerJoinRequests.filter(r => r.status === 'PENDING');

  // Filter users
  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match = u.name.toLowerCase().includes(q) ||
        (u.department && u.department.toLowerCase().includes(q)) ||
        (u.roleTitle && u.roleTitle.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleApproveJoin = (reqId: string, name: string) => {
    approveOfficerJoin(reqId);
    setNotice(`Approved officer registration for ${name}`);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleDeclineJoin = (reqId: string, name: string) => {
    declineOfficerJoin(reqId);
    setNotice(`Declined registration request for ${name}`);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteContact.trim()) return;

    const code = adminInviteUser(inviteName, inviteContact, inviteUnitId, inviteRoleTitle, inviteRole);
    setGeneratedInviteCode(code);
    setNotice(`Invite created with code: ${code}`);
  };

  const handleRegenerateCode = (userId: string, name: string) => {
    const code = regenerateUserInvite(userId);
    setNotice(`New invite code for ${name}: ${code}`);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleToggleDisabled = (userId: string) => {
    const res = toggleUserDisabled(userId);
    if (!res.success) {
      alert(res.error || 'Cannot modify user');
    } else {
      setNotice('User status updated');
      setTimeout(() => setNotice(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            User Accounts & Officer Onboarding
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Manage municipal administrative personnel, field staff and pending joining requests
          </p>
        </div>

        <button
          onClick={() => {
            setGeneratedInviteCode(null);
            setShowInviteModal(true);
          }}
          className="px-3.5 py-1.5 bg-[#0B3D66] hover:bg-[#093254] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Personnel</span>
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#D6DFE8] gap-4">
        <button
          onClick={() => setActiveTab('USERS')}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 ${
            activeTab === 'USERS'
              ? 'border-[#0B3D66] text-[#0B3D66]'
              : 'border-transparent text-[#566475] hover:text-[#16212E]'
          }`}
        >
          Active Personnel Directory ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('JOIN_REQUESTS')}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'JOIN_REQUESTS'
              ? 'border-[#E0681A] text-[#E0681A]'
              : 'border-transparent text-[#566475] hover:text-[#E0681A]'
          }`}
        >
          <span>Pending Join Approvals</span>
          {pendingRequests.length > 0 && (
            <span className="px-1.5 py-0.2 bg-[#E0681A] text-white rounded-full text-[10px]">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'USERS' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search staff name, department, role..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#D6DFE8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0B3D66]"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-[#566475]">Role Filter:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-1.5 bg-white text-[#16212E] focus:outline-hidden"
              >
                <option value="ALL">All Roles</option>
                <option value="officer">Field Officer</option>
                <option value="supervisor">Supervisor (DMC)</option>
                <option value="helpdesk">Helpdesk Operator</option>
                <option value="admin">Corporation Admin</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                    <th className="px-4 py-3">Personnel Name</th>
                    <th className="px-4 py-3">Assigned Role</th>
                    <th className="px-4 py-3">Department & Title</th>
                    <th className="px-4 py-3">Leave Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D6DFE8]">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#16212E]">{user.name}</div>
                        <div className="text-[10px] text-[#566475]">{user.email || 'Municipal ID'}</div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          user.role === 'supervisor' ? 'bg-blue-100 text-[#0B3D66]' :
                          user.role === 'officer' ? 'bg-amber-100 text-amber-800' :
                          user.role === 'helpdesk' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#16212E]">{user.department || user.supervisorUnit || 'HQ'}</div>
                        <div className="text-[10px] text-[#566475]">{user.roleTitle || 'Official'}</div>
                      </td>

                      <td className="px-4 py-3">
                        {user.role === 'officer' ? (
                          user.isOnLeave ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                              <Calendar className="w-3 h-3" />
                              On Leave
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-[#1D7A45]">
                              On Duty
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => handleRegenerateCode(user.id, user.name)}
                          className="px-2 py-1 text-[11px] font-semibold text-[#0B3D66] hover:bg-slate-100 rounded border border-[#D6DFE8] transition-colors"
                          title="Generate new login / invite code"
                        >
                          New Code
                        </button>

                        {user.role === 'officer' && (
                          <button
                            onClick={() => toggleOfficerLeave(user.id, !user.isOnLeave)}
                            className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 rounded border border-[#D6DFE8] transition-colors"
                          >
                            {user.isOnLeave ? 'End Leave' : 'Set Leave'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'JOIN_REQUESTS' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-[#D6DFE8] bg-[#F4F7FA] font-bold text-xs text-[#16212E]">
              Officer Joining Applications ({officerJoinRequests.length})
            </div>

            {officerJoinRequests.length === 0 ? (
              <div className="p-8 text-center text-[#566475] text-xs">
                No joining requests currently pending.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                      <th className="px-4 py-3">Applicant Name</th>
                      <th className="px-4 py-3">Applied Department</th>
                      <th className="px-4 py-3">Designation</th>
                      <th className="px-4 py-3">Invite Code Used</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D6DFE8]">
                    {officerJoinRequests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <strong className="text-[#16212E]">{req.name}</strong>
                          <div className="text-[10px] text-[#566475]">{req.emailOrMobile}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#0B3D66]">
                          {req.department}
                        </td>
                        <td className="px-4 py-3 text-[#16212E]">
                          {req.roleTitle}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-[#566475]">
                          {req.inviteCodeUsed}
                        </td>
                        <td className="px-4 py-3">
                          {req.status === 'PENDING' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Pending
                            </span>
                          ) : req.status === 'APPROVED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#1D7A45]">
                              Approved
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                              Declined
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1.5">
                          {req.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApproveJoin(req.id, req.name)}
                                className="px-2.5 py-1 bg-[#1D7A45] hover:bg-emerald-700 text-white rounded text-[11px] font-semibold"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDeclineJoin(req.id, req.name)}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold"
                              >
                                Decline
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#D6DFE8] space-y-4">
            <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-3">
              <h3 className="font-bold text-sm text-[#16212E]">Generate Personnel Invitation</h3>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {generatedInviteCode ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 text-center">
                <CheckCircle className="w-8 h-8 text-[#1D7A45] mx-auto" />
                <h4 className="font-bold text-sm text-[#16212E]">Invitation Code Generated!</h4>
                <div className="p-3 bg-white rounded-lg border border-[#D6DFE8] font-mono text-lg font-black tracking-widest text-[#0B3D66]">
                  {generatedInviteCode}
                </div>
                <p className="text-[11px] text-[#566475]">
                  Share this invite code with {inviteName}. They can enter it during login to activate their account.
                </p>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="w-full py-2 bg-[#0B3D66] text-white rounded-lg text-xs font-bold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-[#16212E] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. Ramesh Patil"
                    className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0B3D66]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#16212E] mb-1">Official Mobile / Email</label>
                  <input
                    type="text"
                    required
                    value={inviteContact}
                    onChange={(e) => setInviteContact(e.target.value)}
                    placeholder="9822000000 or officer@smkmc.gov"
                    className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0B3D66]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#16212E] mb-1">Role Type</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg bg-white"
                    >
                      <option value="supervisor">Supervisor (DMC)</option>
                      <option value="helpdesk">Helpdesk Operator</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#16212E] mb-1">Attached Unit</label>
                    <select
                      value={inviteUnitId}
                      onChange={(e) => setInviteUnitId(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg bg-white"
                    >
                      {orgUnits.map(u => (
                        <option key={u.id} value={u.id}>{u.nameEn}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#16212E] mb-1">Designation Title</label>
                  <input
                    type="text"
                    value={inviteRoleTitle}
                    onChange={(e) => setInviteRoleTitle(e.target.value)}
                    placeholder="e.g. Deputy Commissioner / Senior Executive"
                    className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-[#D6DFE8]">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 border border-[#D6DFE8] rounded-lg text-xs font-semibold text-[#566475]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0B3D66] text-white rounded-lg text-xs font-semibold hover:bg-[#093254]"
                  >
                    Generate Invite
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
