import { createSignal, createEffect, Show, onCleanup } from 'solid-js'
import { supabase } from '../lib/supabase'
import { z } from 'zod' // Import zod for request validation
import { createQuery } from '@tanstack/solid-query'
import { useAuth } from '../hooks/useAuth'
import './UserInfo.css'; // Make sure this import is present

// Define a schema for profile data
const ProfileSchema = z.object({
  username: z.string().nullable(),
})

export function UserInfo(props: { session: { user: any } }) {
  const [isDropdownOpen, setIsDropdownOpen] = createSignal(false)
  const [isEditingProfile, setIsEditingProfile] = createSignal(false)
  const [username, setUsername] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  let dropdownRef: HTMLDivElement | undefined

  const profileQuery = createQuery(() => ({
    queryKey: ['profile', props.session.user.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(`username`)
          .eq('id', props.session.user.id)
          .single();

        if (error) throw error;

        return ProfileSchema.parse(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
        return { username: null };
      }
    },
  }))

  createEffect(() => {
    if (profileQuery.data) {
      setUsername(profileQuery.data.username)
    }
  })

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      setIsDropdownOpen(false)
    }
  }

  createEffect(() => {
    if (isDropdownOpen()) {
      document.addEventListener('mousedown', handleClickOutside)
      onCleanup(() => {
        document.removeEventListener('mousedown', handleClickOutside)
      })
    }
  })

  async function updateProfile(e: Event) {
    e.preventDefault()

    try {
      const { user } = props.session

      const updates = {
        id: user.id,
        username: username(),
        updated_at: new Date(),
      }

      const UpdateSchema = ProfileSchema.extend({ 
        id: z.string(), 
        updated_at: z.date() 
      })
      const validatedUpdates = UpdateSchema.parse(updates)

      const { error } = await supabase.from('profiles').upsert(validatedUpdates)

      if (error) throw error
      setIsEditingProfile(false)
    } catch (error: any) {
      console.error('Error updating profile:', error.message)
      setError(error.message)
    }
  }

  const { signOut } = useAuth();

  const handleSignOut = async () => {
    console.log("Starting sign out process");
    try {
      await signOut();
      console.log("Sign out completed");
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };

  return (
    <div class="user-info-container" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen())}
        class="user-info-button"
        aria-haspopup="true"
        aria-expanded={isDropdownOpen()}
      >
        <div class="user-avatar">
          {username()?.[0]?.toUpperCase() || 'U'}
        </div>
        <span class="user-name">{username() || props.session.user.email}</span>
        <svg class="dropdown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      <Show when={isDropdownOpen()}>
        <div 
          class="dropdown-menu"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu"
        >
          <div class="dropdown-content" role="none">
            <button
              onClick={() => {
                setIsEditingProfile(true)
                setIsDropdownOpen(false)
              }}
              class="dropdown-item"
              role="menuitem"
            >
              Edit Profile
            </button>
            <button
              onClick={handleSignOut}
              class="dropdown-item"
              role="menuitem"
            >
              Sign Out
            </button>
          </div>
        </div>
      </Show>

      <Show when={isEditingProfile()}>
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-gray-800 p-6 rounded-lg shadow-xl w-96">
            <h2 class="text-xl font-bold text-white mb-4">Edit Profile</h2>
            <form onSubmit={updateProfile} class="space-y-4">
              <div>
                <label for="email" class="block text-sm font-medium text-gray-300">Email</label>
                <input id="email" type="text" value={props.session.user.email} disabled
                  class="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label for="username" class="block text-sm font-medium text-gray-300">Name</label>
                <input
                  id="username"
                  type="text"
                  value={username() || ''}
                  onChange={(e) => setUsername(e.currentTarget.value || null)}
                  class="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div class="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={profileQuery.isLoading}
                >
                  {profileQuery.isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
            <Show when={error()}>
              <p class="text-red-500 mt-2">{error()}</p>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
