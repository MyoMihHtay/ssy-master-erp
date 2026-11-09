import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
} from 'react';

import {
  Send,
  Paperclip,
  Mic,
  Square,
  X,
  MessageCircle,
  Trash2,
  Edit2,
  CheckCheck,
  Lock,
  RefreshCw,
  EyeOff,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';

import { mavoraSupabase } from '../mavoraSupabase';
import type { AppLanguage } from '../i18n';
import { WorkspaceAccessControl } from './WorkspaceAccessControl';

const SECURE_BUCKET =
  'workspace-secure-files';

const SIGNED_URL_TTL_SECONDS =
  60 * 60;

const DELETE_REFRESH_INTERVAL_MS =
  25_000;

interface WorkspacePost {
  id: string;
  tenant_id: string;
  sender_user_id: string;
  sender_name: string;
  sender_role: string;
  post_type: string;
  content: string | null;
  photo_url: string | null;
  audio_url: string | null;
  is_sensitive: boolean;
  created_at: string;
  updated_at?: string;

  photo_display_url?: string | null;
  audio_display_url?: string | null;
}

interface WorkspaceAccess {
  auth_user_id: string;
  tenant_id: string;
  access_level: string;

  can_view: boolean;
  can_send: boolean;
  can_upload: boolean;
  can_delete_own: boolean;
  can_delete_others: boolean;
  can_view_sensitive: boolean;
  can_manage_members: boolean;

  is_workspace_owner: boolean;

  note: string | null;
  updated_at: string | null;
}

interface SignedUrlCacheItem {
  url: string;
  expiresAt: number;
}

interface WorkspaceProps {
  language: AppLanguage;

  tenantId: string;
  tenantName: string;

  authUserId: string;

  userName: string;
  roleCode: string;

  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const label = (
  language: AppLanguage,
  myanmar: string,
  english: string
) =>
  language === 'en'
    ? english
    : myanmar;

const getRoleLabel = (
  roleCode: string
) => {
  const normalized =
    String(roleCode || '')
      .trim()
      .toUpperCase();

  if (!normalized) {
    return 'USER';
  }

  if (normalized === 'OWNER') {
    return 'OWNER';
  }

  if (
    normalized === 'MD'
    || normalized === 'MANAGING_DIRECTOR'
  ) {
    return 'MD';
  }

  return normalized.replaceAll(
    '_',
    ' '
  );
};

export const Workspace = ({
  language,
  tenantId,
  tenantName,
  authUserId,
  userName,
  roleCode,
  theme,
  onToggleTheme,
}: WorkspaceProps) => {
  const isDark =
    theme === 'dark';
  const [
    posts,
    setPosts,
  ] = useState<WorkspacePost[]>([]);

  const [
    content,
    setContent,
  ] = useState('');

  const [
    imageFile,
    setImageFile,
  ] = useState<File | null>(null);

  const [
    imagePreviewUrl,
    setImagePreviewUrl,
  ] = useState<string | null>(null);

  const [
    audioBlob,
    setAudioBlob,
  ] = useState<Blob | null>(null);

  const [
    audioUrl,
    setAudioUrl,
  ] = useState<string | null>(null);

  const [
    isRecording,
    setIsRecording,
  ] = useState(false);

  const [
    isSensitive,
    setIsSensitive,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(null);

  const [
    editContent,
    setEditContent,
  ] = useState('');

  const [
    workspaceAccess,
    setWorkspaceAccess,
  ] = useState<WorkspaceAccess | null>(
    null
  );

  const [
    accessLoading,
    setAccessLoading,
  ] = useState(true);

  const [
    postsLoading,
    setPostsLoading,
  ] = useState(false);

  const [
    workspaceError,
    setWorkspaceError,
  ] = useState<string | null>(null);

  const [
    isAccessControlOpen,
    setIsAccessControlOpen,
  ] = useState(false);

  const mediaRecorder =
    useRef<MediaRecorder | null>(
      null
    );

  const audioChunks =
    useRef<Blob[]>([]);

  const chatScrollRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const stickToBottomRef =
    useRef(true);

  const accessInitializedRef =
    useRef(false);

  const signedUrlCacheRef =
    useRef(
      new Map<
        string,
        SignedUrlCacheItem
      >()
    );

  const canView =
    Boolean(
      workspaceAccess?.can_view
    );

  const canSend =
    Boolean(
      workspaceAccess?.can_send
    );

  const canUpload =
    Boolean(
      workspaceAccess?.can_upload
    );

  const canViewSensitive =
    Boolean(
      workspaceAccess
        ?.can_view_sensitive
    );

  const isWorkspaceOwner =
    Boolean(
      workspaceAccess
        ?.is_workspace_owner
    );

  useEffect(() => {
    accessInitializedRef.current =
      false;

    signedUrlCacheRef.current.clear();

    setWorkspaceAccess(null);
    setPosts([]);
    setWorkspaceError(null);
    setAccessLoading(true);
    setEditingId(null);
    setEditContent('');
    setIsSensitive(false);
  }, [
    tenantId,
    authUserId,
  ]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }

    const url =
      URL.createObjectURL(
        imageFile
      );

    setImagePreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [
    imageFile,
  ]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(
          audioUrl
        );
      }
    };
  }, [
    audioUrl,
  ]);

  const loadMyWorkspaceAccess =
    useCallback(
      async () => {
        if (
          !accessInitializedRef.current
        ) {
          setAccessLoading(true);
        }

        try {
          if (
            !tenantId
            || !authUserId
          ) {
            throw new Error(
              'MAVORA_WORKSPACE_CONTEXT_MISSING'
            );
          }

          const {
            data: {
              user: authUser,
            },
            error: authError,
          } =
            await mavoraSupabase
              .auth
              .getUser();

          if (authError) {
            throw authError;
          }

          if (
            !authUser
            || authUser.id
              !== authUserId
          ) {
            throw new Error(
              'MAVORA_WORKSPACE_AUTH_MISMATCH'
            );
          }

          const {
            data,
            error,
          } =
            await mavoraSupabase.rpc(
              'get_my_workspace_access',
              {
                p_tenant_id:
                  tenantId,
              }
            );

          if (error) {
            throw error;
          }

          const rows: WorkspaceAccess[] =
            Array.isArray(data)
              ? (data as WorkspaceAccess[])
              : [];

          const access =
            rows[0] ?? null;

          setWorkspaceAccess(
            access
          );

          if (!access) {
            setWorkspaceError(
              label(
                language,
                'Workspace အသုံးပြုခွင့် မသတ်မှတ်ရသေးပါ။',
                'Workspace access has not been assigned.'
              )
            );

            return null;
          }

          if (!access.can_view) {
            setWorkspaceError(
              label(
                language,
                'Workspace ကြည့်ရှုခွင့် ပိတ်ထားပါသည်။',
                'Workspace viewing access is disabled.'
              )
            );

            return access;
          }

          setWorkspaceError(
            null
          );

          return access;
        } catch (error: any) {
          console.error(
            'MAVORA Workspace access failed:',
            error
          );

          setWorkspaceAccess(
            null
          );

          setWorkspaceError(
            error?.message
            || label(
              language,
              'Workspace Permission စစ်ဆေး၍ မရပါ။',
              'Unable to check Workspace permission.'
            )
          );

          return null;
        } finally {
          accessInitializedRef.current =
            true;

          setAccessLoading(
            false
          );
        }
      },
      [
        authUserId,
        language,
        tenantId,
      ]
    );

  useEffect(() => {
    void loadMyWorkspaceAccess();

    const intervalId =
      window.setInterval(
        () => {
          void loadMyWorkspaceAccess();
        },
        30_000
      );

    const handleFocus = () => {
      void loadMyWorkspaceAccess();
    };

    window.addEventListener(
      'focus',
      handleFocus
    );

    return () => {
      window.clearInterval(
        intervalId
      );

      window.removeEventListener(
        'focus',
        handleFocus
      );
    };
  }, [
    loadMyWorkspaceAccess,
  ]);

  const resolveMediaUrl =
    useCallback(
      async (
        storedValue:
          string | null
      ) => {
        if (
          !storedValue
          || !storedValue.startsWith(
            'secure:'
          )
        ) {
          return null;
        }

        const path =
          storedValue.slice(
            'secure:'.length
          );

        const cached =
          signedUrlCacheRef
            .current
            .get(path);

        if (
          cached
          && cached.expiresAt
            > Date.now()
              + 60_000
        ) {
          return cached.url;
        }

        const {
          data,
          error,
        } =
          await mavoraSupabase
            .storage
            .from(
              SECURE_BUCKET
            )
            .createSignedUrl(
              path,
              SIGNED_URL_TTL_SECONDS
            );

        if (
          error
          || !data?.signedUrl
        ) {
          console.error(
            'Workspace signed URL failed:',
            error
          );

          return null;
        }

        signedUrlCacheRef
          .current
          .set(
            path,
            {
              url:
                data.signedUrl,

              expiresAt:
                Date.now()
                + SIGNED_URL_TTL_SECONDS
                  * 1000,
            }
          );

        return data.signedUrl;
      },
      []
    );

  const hydratePosts =
    useCallback(
      async (
        rows: WorkspacePost[]
      ) =>
        Promise.all(
          rows.map(
            async (
              post
            ) => ({
              ...post,

              photo_display_url:
                await resolveMediaUrl(
                  post.photo_url
                ),

              audio_display_url:
                await resolveMediaUrl(
                  post.audio_url
                ),
            })
          )
        ),
      [
        resolveMediaUrl,
      ]
    );

  const fetchPosts =
    useCallback(
      async () => {
        if (
          !tenantId
          || !workspaceAccess
            ?.can_view
        ) {
          setPosts([]);
          return;
        }

        setPostsLoading(true);

        try {
          const {
            data,
            error,
          } =
            await mavoraSupabase
              .from(
                'workspace_posts'
              )
              .select(`
                id,
                tenant_id,
                sender_user_id,
                sender_name,
                sender_role,
                post_type,
                content,
                photo_url,
                audio_url,
                is_sensitive,
                created_at,
                updated_at
              `)
              .eq(
                'tenant_id',
                tenantId
              )
              .order(
                'created_at',
                {
                  ascending:
                    true,
                }
              );

          if (error) {
            throw error;
          }

          const hydrated =
            await hydratePosts(
              (
                data
                ?? []
              ) as WorkspacePost[]
            );

          setPosts(
            hydrated
          );

          setWorkspaceError(
            null
          );
        } catch (error: any) {
          console.error(
            'MAVORA Workspace fetch failed:',
            error
          );

          if (
            error?.code
              === '42501'
            || String(
              error?.message
              || ''
            )
              .toLowerCase()
              .includes(
                'permission'
              )
          ) {
            setPosts([]);

            setWorkspaceError(
              label(
                language,
                'Workspace ကြည့်ရှုခွင့် မရှိပါ။',
                'You do not have permission to view Workspace.'
              )
            );

            void loadMyWorkspaceAccess();
          }
        } finally {
          setPostsLoading(
            false
          );
        }
      },
      [
        hydratePosts,
        language,
        loadMyWorkspaceAccess,
        tenantId,
        workspaceAccess
          ?.can_view,
      ]
    );

  useEffect(() => {
    if (
      !tenantId
      || !workspaceAccess
        ?.can_view
    ) {
      setPosts([]);
      return;
    }

    void fetchPosts();

    const refreshPosts = () => {
      void fetchPosts();
    };

    const channel =
      mavoraSupabase
        .channel(
          `mavora_workspace_${tenantId}_${authUserId}`
        )
        .on(
          'postgres_changes',
          {
            event:
              'INSERT',
            schema:
              'public',
            table:
              'workspace_posts',
            filter:
              `tenant_id=eq.${tenantId}`,
          },
          refreshPosts
        )
        .on(
          'postgres_changes',
          {
            event:
              'UPDATE',
            schema:
              'public',
            table:
              'workspace_posts',
            filter:
              `tenant_id=eq.${tenantId}`,
          },
          refreshPosts
        )
        .subscribe();

    // DELETE events are intentionally
    // not subscribed to here.
    // Periodic RLS-protected SELECT
    // refresh safely synchronizes
    // deletions across clients.
    const deleteRefreshInterval =
      window.setInterval(
        refreshPosts,
        DELETE_REFRESH_INTERVAL_MS
      );

    const handleFocus = () => {
      refreshPosts();
    };

    window.addEventListener(
      'focus',
      handleFocus
    );

    return () => {
      window.clearInterval(
        deleteRefreshInterval
      );

      window.removeEventListener(
        'focus',
        handleFocus
      );

      void mavoraSupabase
        .removeChannel(
          channel
        );
    };
  }, [
    authUserId,
    fetchPosts,
    tenantId,
    workspaceAccess
      ?.can_view,
    workspaceAccess
      ?.can_view_sensitive,
  ]);

  const handleChatScroll =
    useCallback(
      () => {
        const element =
          chatScrollRef.current;

        if (!element) {
          return;
        }

        const distance =
          element.scrollHeight
          - element.scrollTop
          - element.clientHeight;

        stickToBottomRef.current =
          distance < 120;
      },
      []
    );

  const scrollChatToBottom =
    useCallback(
      (
        behavior:
          ScrollBehavior =
            'auto'
      ) => {
        window
          .requestAnimationFrame(
            () => {
              const element =
                chatScrollRef
                  .current;

              if (!element) {
                return;
              }

              element.scrollTo({
                top:
                  element
                    .scrollHeight,

                behavior,
              });
            }
          );
      },
      []
    );

  useEffect(() => {
    if (
      !stickToBottomRef.current
    ) {
      return;
    }

    scrollChatToBottom(
      'auto'
    );
  }, [
    posts.length,
    scrollChatToBottom,
  ]);

  const clearAudio = () => {
    if (audioUrl) {
      URL.revokeObjectURL(
        audioUrl
      );
    }

    setAudioUrl(null);
    setAudioBlob(null);
  };

  const startRecording =
    async () => {
      if (!canSend) {
        alert(
          label(
            language,
            'Message ပို့ခွင့်မရှိပါ။',
            'You do not have permission to send messages.'
          )
        );

        return;
      }

      if (!canUpload) {
        alert(
          label(
            language,
            'Audio Upload ခွင့်မရှိပါ။',
            'You do not have permission to upload audio.'
          )
        );

        return;
      }

      try {
        const stream =
          await navigator
            .mediaDevices
            .getUserMedia({
              audio: true,
            });

        const recorder =
          new MediaRecorder(
            stream
          );

        mediaRecorder.current =
          recorder;

        audioChunks.current =
          [];

        recorder.ondataavailable =
          (
            event
          ) => {
            if (
              event.data.size
                > 0
            ) {
              audioChunks
                .current
                .push(
                  event.data
                );
            }
          };

        recorder.onstop =
          () => {
            const mimeType =
              recorder
                .mimeType
              || 'audio/webm';

            const blob =
              new Blob(
                audioChunks
                  .current,
                {
                  type:
                    mimeType,
                }
              );

            setAudioBlob(
              blob
            );

            const previewUrl =
              URL
                .createObjectURL(
                  blob
                );

            setAudioUrl(
              (
                previous
              ) => {
                if (
                  previous
                ) {
                  URL
                    .revokeObjectURL(
                      previous
                    );
                }

                return previewUrl;
              }
            );

            stream
              .getTracks()
              .forEach(
                (
                  track
                ) =>
                  track.stop()
              );
          };

        recorder.start();

        setIsRecording(
          true
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          label(
            language,
            'မိုက်ကရိုဖုန်း အသုံးပြုခွင့် မရပါ။',
            'Microphone access is not available.'
          )
        );
      }
    };

  const stopRecording =
    () => {
      if (
        mediaRecorder
          .current
        && isRecording
      ) {
        mediaRecorder
          .current
          .stop();

        setIsRecording(
          false
        );
      }
    };

  const handleImagePaste =
    (
      event:
        ClipboardEvent<HTMLTextAreaElement>
    ) => {
      const imageItem =
        Array
          .from(
            event
              .clipboardData
              .items
          )
          .find(
            (
              item
            ) =>
              item.type
                .startsWith(
                  'image/'
                )
          );

      if (!imageItem) {
        return;
      }

      event.preventDefault();

      if (
        !canSend
        || !canUpload
      ) {
        alert(
          label(
            language,
            'Screenshot / Image Paste အတွက် Send + Upload Permission လိုပါသည်။',
            'Send and Upload permissions are required to paste images.'
          )
        );

        return;
      }

      const pastedFile =
        imageItem
          .getAsFile();

      if (!pastedFile) {
        return;
      }

      const mimeType =
        pastedFile.type
        || 'image/png';

      let extension =
        'png';

      if (
        mimeType.includes(
          'jpeg'
        )
      ) {
        extension =
          'jpg';
      } else if (
        mimeType.includes(
          'webp'
        )
      ) {
        extension =
          'webp';
      } else if (
        mimeType.includes(
          'gif'
        )
      ) {
        extension =
          'gif';
      }

      setImageFile(
        new File(
          [
            pastedFile,
          ],
          `clipboard_${Date.now()}.${extension}`,
          {
            type:
              mimeType,
          }
        )
      );
    };

  const uploadSecureFile =
    async (
      file:
        File | Blob,
      category:
        'image'
        | 'audio',
      originalName?:
        string
    ) => {
      if (
        !tenantId
        || !authUserId
      ) {
        throw new Error(
          'MAVORA_WORKSPACE_CONTEXT_MISSING'
        );
      }

      if (
        !workspaceAccess
          ?.can_upload
      ) {
        throw new Error(
          'MAVORA_WORKSPACE_UPLOAD_DENIED'
        );
      }

      if (
        isSensitive
        && !workspaceAccess
          .can_view_sensitive
      ) {
        throw new Error(
          'MAVORA_WORKSPACE_SENSITIVE_DENIED'
        );
      }

      if (
        file.size
        > 25
          * 1024
          * 1024
      ) {
        throw new Error(
          'Maximum Workspace file size is 25 MB.'
        );
      }

      const folder =
        isSensitive
          ? 'sensitive'
          : 'general';

      const rawMime =
        file.type
        || (
          category
            === 'image'
            ? 'image/jpeg'
            : 'audio/webm'
        );

      if (
        category
          === 'image'
        && !rawMime
          .startsWith(
            'image/'
          )
      ) {
        throw new Error(
          'Invalid image MIME type.'
        );
      }

      if (
        category
          === 'audio'
        && !rawMime
          .startsWith(
            'audio/'
          )
      ) {
        throw new Error(
          'Invalid audio MIME type.'
        );
      }

      let extension =
        originalName
          ?.split('.')
          .pop()
          ?.toLowerCase()
        || '';

      if (!extension) {
        if (
          rawMime.includes(
            'png'
          )
        ) {
          extension =
            'png';
        } else if (
          rawMime.includes(
            'jpeg'
          )
        ) {
          extension =
            'jpg';
        } else if (
          rawMime.includes(
            'webp'
          )
        ) {
          extension =
            'webp';
        } else if (
          rawMime.includes(
            'gif'
          )
        ) {
          extension =
            'gif';
        } else if (
          rawMime.includes(
            'ogg'
          )
        ) {
          extension =
            'ogg';
        } else if (
          rawMime.includes(
            'wav'
          )
        ) {
          extension =
            'wav';
        } else if (
          rawMime.includes(
            'webm'
          )
        ) {
          extension =
            'webm';
        } else {
          extension =
            category
              === 'image'
              ? 'jpg'
              : 'mp4';
        }
      }

      const fileName =
        `${category}_${Date.now()}_`
        + `${Math.random().toString(36).slice(2)}.${extension}`;

      const path =
        `${tenantId}/${folder}/${authUserId}/${fileName}`;

      const {
        error,
      } =
        await mavoraSupabase
          .storage
          .from(
            SECURE_BUCKET
          )
          .upload(
            path,
            file,
            {
              contentType:
                rawMime,

              upsert:
                false,
            }
          );

      if (error) {
        throw error;
      }

      return {
        ref:
          `secure:${path}`,

        path,
      };
    };

  const handleSubmit =
    async () => {
      if (
        !content.trim()
        && !imageFile
        && !audioBlob
      ) {
        return;
      }

      if (
        isSubmitting
      ) {
        return;
      }

      if (!canSend) {
        alert(
          label(
            language,
            'Message ပို့ခွင့်မရှိပါ။',
            'You do not have permission to send messages.'
          )
        );

        void loadMyWorkspaceAccess();
        return;
      }

      if (
        (
          imageFile
          || audioBlob
        )
        && !canUpload
      ) {
        alert(
          label(
            language,
            'Image / Audio Upload ခွင့်မရှိပါ။',
            'You do not have permission to upload images or audio.'
          )
        );

        void loadMyWorkspaceAccess();
        return;
      }

      if (
        isSensitive
        && !canViewSensitive
      ) {
        alert(
          label(
            language,
            'Sensitive Information အသုံးပြုခွင့်မရှိပါ။',
            'You do not have permission to use Sensitive Information.'
          )
        );

        setIsSensitive(
          false
        );

        return;
      }

      setIsSubmitting(
        true
      );

      setWorkspaceError(
        null
      );

      const uploadedPaths:
        string[] =
          [];

      try {
        let finalPhotoRef:
          string | null =
            null;

        let finalAudioRef:
          string | null =
            null;

        if (
          imageFile
        ) {
          const upload =
            await uploadSecureFile(
              imageFile,
              'image',
              imageFile.name
            );

          finalPhotoRef =
            upload.ref;

          uploadedPaths.push(
            upload.path
          );
        }

        if (
          audioBlob
        ) {
          const upload =
            await uploadSecureFile(
              audioBlob,
              'audio'
            );

          finalAudioRef =
            upload.ref;

          uploadedPaths.push(
            upload.path
          );
        }

        const {
          data,
          error,
        } =
          await mavoraSupabase
            .rpc(
              'create_workspace_post_secure',
              {
                p_tenant_id:
                  tenantId,

                p_post_type:
                  'general',

                p_content:
                  content
                    .trim()
                  || '',

                p_photo_url:
                  finalPhotoRef,

                p_audio_url:
                  finalAudioRef,

                p_is_sensitive:
                  isSensitive,
              }
            );

        if (error) {
          throw error;
        }

        const createdRows: WorkspacePost[] =
          Array.isArray(data)
            ? (data as WorkspacePost[])
            : [];

        if (
          createdRows.length
            > 0
        ) {
          const hydrated =
            await hydratePosts(
              createdRows
            );

          stickToBottomRef.current =
            true;

          setPosts(
            (
              previous
            ) => {
              const merged =
                new Map<
                  string,
                  WorkspacePost
                >();

              previous
                .forEach(
                  (
                    post
                  ) =>
                    merged.set(
                      post.id,
                      post
                    )
                );

              hydrated
                .forEach(
                  (
                    post
                  ) =>
                    merged.set(
                      post.id,
                      post
                    )
                );

              return Array
                .from(
                  merged.values()
                )
                .sort(
                  (
                    a,
                    b
                  ) =>
                    new Date(
                      a.created_at
                    ).getTime()
                    - new Date(
                      b.created_at
                    ).getTime()
                );
            }
          );

          scrollChatToBottom(
            'smooth'
          );
        } else {
          await fetchPosts();
        }

        setContent('');
        setImageFile(null);
        clearAudio();
        setIsSensitive(
          false
        );
      } catch (
        error: any
      ) {
        console.error(
          'MAVORA Workspace send failed:',
          error
        );

        if (
          uploadedPaths.length
            > 0
          && workspaceAccess
            ?.can_delete_own
        ) {
          const {
            error:
              cleanupError,
          } =
            await mavoraSupabase
              .storage
              .from(
                SECURE_BUCKET
              )
              .remove(
                uploadedPaths
              );

          if (
            cleanupError
          ) {
            console.warn(
              'Workspace orphan cleanup failed:',
              cleanupError
            );
          }
        }

        alert(
          label(
            language,
            'Message ပို့ရာတွင် အမှားရှိပါသည်: ',
            'Error while sending: '
          )
          + (
            error?.message
            || 'Unknown error'
          )
        );

        await loadMyWorkspaceAccess();
      } finally {
        setIsSubmitting(
          false
        );
      }
    };

  const handleUpdate =
    async (
      post:
        WorkspacePost
    ) => {
      const newContent =
        editContent.trim();

      if (!newContent) {
        return;
      }

      if (
        post.sender_user_id
          !== authUserId
      ) {
        alert(
          label(
            language,
            'မိမိကိုယ်ပိုင် Message ကိုသာ ပြင်နိုင်ပါသည်။',
            'You can edit only your own message.'
          )
        );

        setEditingId(
          null
        );

        return;
      }

      if (!canSend) {
        alert(
          label(
            language,
            'Message ပြင်ရန် Send Permission လိုပါသည်။',
            'Send permission is required to edit a message.'
          )
        );

        return;
      }

      try {
        const {
          error,
        } =
          await mavoraSupabase
            .rpc(
              'update_workspace_post_secure',
              {
                p_post_id:
                  post.id,

                p_content:
                  newContent,
              }
            );

        if (error) {
          throw error;
        }

        setEditingId(
          null
        );

        setEditContent(
          ''
        );

        await fetchPosts();
      } catch (
        error: any
      ) {
        console.error(
          'MAVORA Workspace edit failed:',
          error
        );

        alert(
          label(
            language,
            'Message ပြင်ရာတွင် အမှားရှိပါသည်: ',
            'Error while editing: '
          )
          + (
            error?.message
            || 'Permission denied'
          )
        );

        await loadMyWorkspaceAccess();
        await fetchPosts();
      }
    };

  const handleDelete =
    async (
      post:
        WorkspacePost
    ) => {
      const isOwn =
        post.sender_user_id
          === authUserId;

      const allowed =
        isOwn
          ? Boolean(
              workspaceAccess
                ?.can_delete_own
            )
          : Boolean(
              workspaceAccess
                ?.can_delete_others
            );

      if (!allowed) {
        alert(
          label(
            language,
            'ဤ Message ကို ဖျက်ရန် Permission မရှိပါ။',
            'You do not have permission to delete this message.'
          )
        );

        return;
      }

      if (
        !window.confirm(
          label(
            language,
            'ဤ Message ကို ဖျက်ရန် သေချာပါသလား?',
            'Are you sure you want to delete this message?'
          )
        )
      ) {
        return;
      }

      try {
        const {
          error,
        } =
          await mavoraSupabase
            .rpc(
              'delete_workspace_post_secure',
              {
                p_post_id:
                  post.id,
              }
            );

        if (error) {
          throw error;
        }

        const securePaths =
          [
            post.photo_url,
            post.audio_url,
          ]
            .filter(
              (
                value
              ): value is string =>
                Boolean(
                  value
                    ?.startsWith(
                      'secure:'
                    )
                )
            )
            .map(
              (
                value
              ) =>
                value.slice(
                  'secure:'.length
                )
            );

        if (
          securePaths.length
            > 0
        ) {
          const {
            error:
              storageError,
          } =
            await mavoraSupabase
              .storage
              .from(
                SECURE_BUCKET
              )
              .remove(
                securePaths
              );

          if (
            storageError
          ) {
            console.warn(
              'Workspace attachment cleanup failed:',
              storageError
            );
          }
        }

        setPosts(
          (
            previous
          ) =>
            previous.filter(
              (
                item
              ) =>
                item.id
                  !== post.id
            )
        );

        await fetchPosts();
      } catch (
        error: any
      ) {
        console.error(
          'MAVORA Workspace delete failed:',
          error
        );

        alert(
          label(
            language,
            'Message ဖျက်ရာတွင် အမှားရှိပါသည်: ',
            'Error while deleting: '
          )
          + (
            error?.message
            || 'Permission denied'
          )
        );

        await loadMyWorkspaceAccess();
        await fetchPosts();
      }
    };

  const formatDate =
    (
      value:
        string
    ) => {
      try {
        return new Date(
          value
        ).toLocaleString(
          language === 'en'
            ? 'en-US'
            : 'my-MM'
        );
      } catch {
        return value;
      }
    };

  if (
    accessLoading
  ) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border bg-slate-50">
        <div className="text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-indigo-500" />

          <div className="mt-3 text-sm font-bold text-slate-500">
            {label(
              language,
              'Workspace Permission စစ်ဆေးနေပါသည်...',
              'Checking Workspace permission...'
            )}
          </div>
        </div>
      </div>
    );
  }

  if (
    !workspaceAccess
    || !canView
  ) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border bg-slate-50 p-6">
        <div className="max-w-lg rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-sm">
          <Lock className="mx-auto h-10 w-10 text-amber-500" />

          <h2 className="mt-4 text-xl font-black text-slate-900">
            Secure Workspace
          </h2>

          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
            {workspaceError
              || label(
                language,
                'Workspace အသုံးပြုခွင့် မရှိပါ။',
                'Workspace access is not available.'
              )}
          </p>

          <button
            type="button"
            onClick={() =>
              void loadMyWorkspaceAccess()
            }
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
          >
            <RefreshCw size={16} />
            Refresh Permission
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mavora-workspace-shell ${
        isDark
          ? 'mavora-workspace-dark'
          : 'mavora-workspace-light'
      } mx-auto flex h-[calc(100vh-120px)] min-h-[560px] max-w-6xl flex-col overflow-hidden rounded-3xl border shadow-xl`}
    >
      <div className="mavora-workspace-header shrink-0 border-b px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
              <MessageCircle size={24} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-black md:text-xl">
                  MAVORA Secure Workspace
                </h2>

                <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                  Secure
                </span>

                <span className="flex items-center gap-1 rounded-full bg-sky-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-sky-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </span>

                <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-300">
                  {getRoleLabel(
                    roleCode
                  )}
                </span>

                {isWorkspaceOwner && (
                  <span className="rounded-full bg-amber-400/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-300">
                    Workspace Owner
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap gap-x-3 text-xs font-medium text-slate-400">
                <span>
                  {tenantName}
                </span>

                <span>
                  •
                </span>

                <span>
                  {userName}
                </span>

                <span>
                  •
                </span>

                <span>
                  {workspaceAccess.access_level}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="mavora-theme-toggle flex h-9 w-9 items-center justify-center rounded-xl border transition"
              title={
                isDark
                  ? 'Switch to Light Mode'
                  : 'Switch to Dark Mode'
              }
            >
              {isDark
                ? <Sun size={16} />
                : <Moon size={16} />}
            </button>

            {isWorkspaceOwner && (
              <button
                type="button"
                onClick={() =>
                  setIsAccessControlOpen(
                    true
                  )
                }
                className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-400/15"
              >
                <ShieldCheck size={15} />
                Access Control
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                void fetchPosts()
              }
              disabled={postsLoading}
              className="mavora-workspace-refresh flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={
                  postsLoading
                    ? 'animate-spin'
                    : ''
                }
              />

              Refresh
            </button>
          </div>
        </div>
      </div>

      {workspaceError && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 md:px-6">
          {workspaceError}
        </div>
      )}

      <div
        ref={chatScrollRef}
        onScroll={handleChatScroll}
        className="mavora-workspace-chat min-h-0 flex-1 overflow-y-auto px-3 py-5 md:px-6"
      >
        {postsLoading
          && posts.length === 0
          ? (
            <div className="flex h-full min-h-[240px] items-center justify-center">
              <div className="text-center text-slate-400">
                <RefreshCw className="mx-auto h-6 w-6 animate-spin" />

                <div className="mt-3 text-sm font-bold">
                  Loading secure messages...
                </div>
              </div>
            </div>
          )
          : posts.length === 0
            ? (
              <div className="flex h-full min-h-[240px] items-center justify-center">
                <div className="text-center">
                  <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />

                  <div className="mt-3 text-base font-black text-slate-500">
                    {label(
                      language,
                      'Secure Workspace တွင် Message မရှိသေးပါ။',
                      'No secure Workspace messages yet.'
                    )}
                  </div>
                </div>
              </div>
            )
            : (
              <div className="space-y-4">
                {posts.map(
                  (
                    post
                  ) => {
                    const isOwn =
                      post.sender_user_id
                        === authUserId;

                    const canDelete =
                      isOwn
                        ? Boolean(
                            workspaceAccess
                              .can_delete_own
                          )
                        : Boolean(
                            workspaceAccess
                              .can_delete_others
                          );

                    const canEdit =
                      isOwn
                      && canSend;

                    return (
                      <div
                        key={post.id}
                        className={`flex ${
                          isOwn
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        <div
                          className={`group max-w-[92%] md:max-w-[76%] ${
                            isOwn
                              ? 'items-end'
                              : 'items-start'
                          }`}
                        >
                          <div className={`mb-1 flex items-center gap-2 px-1 ${
                            isOwn
                              ? 'justify-end'
                              : 'justify-start'
                          }`}>
                            <span className="text-xs font-black text-slate-600">
                              {post.sender_name}
                            </span>

                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-black uppercase text-slate-600">
                              {getRoleLabel(
                                post.sender_role
                              )}
                            </span>

                            {post.is_sensitive && (
                              <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black uppercase text-rose-700">
                                <EyeOff size={10} />
                                Sensitive
                              </span>
                            )}
                          </div>

                          <div
                            className={`mavora-message-bubble ${
                              isOwn
                                ? 'mavora-message-own rounded-br-md'
                                : 'mavora-message-other rounded-bl-md'
                            } rounded-3xl border px-4 py-3 shadow-sm`}
                          >
                            {editingId
                              === post.id
                              ? (
                                <div>
                                  <textarea
                                    value={editContent}
                                    onChange={(
                                      event
                                    ) =>
                                      setEditContent(
                                        event.target.value
                                      )
                                    }
                                    rows={3}
                                    className="w-full min-w-[250px] rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-400"
                                  />

                                  <div className="mt-2 flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleUpdate(
                                          post
                                        )
                                      }
                                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white"
                                    >
                                      Save
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingId(
                                          null
                                        );

                                        setEditContent(
                                          ''
                                        );
                                      }}
                                      className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )
                              : (
                                <>
                                  {post.content && (
                                    <p className="whitespace-pre-wrap break-words text-sm font-medium leading-relaxed">
                                      {post.content}
                                    </p>
                                  )}

                                  {post.photo_display_url && (
                                    <img
                                      src={post.photo_display_url}
                                      alt="Workspace attachment"
                                      className="mt-3 max-h-[360px] w-auto max-w-full rounded-2xl border border-black/10 object-contain"
                                    />
                                  )}

                                  {post.audio_display_url && (
                                    <div className="mt-3 rounded-xl bg-black/5 p-2">
                                      <audio
                                        controls
                                        src={post.audio_display_url}
                                        className="h-10 max-w-full"
                                      />
                                    </div>
                                  )}
                                </>
                              )}

                            <div
                              className={`mt-2 flex items-center justify-between gap-4 text-[10px] font-medium ${
                                isOwn
                                  ? 'text-indigo-100'
                                  : 'text-slate-400'
                              }`}
                            >
                              <span>
                                {formatDate(
                                  post.created_at
                                )}
                              </span>

                              {isOwn && (
                                <CheckCheck size={13} />
                              )}
                            </div>
                          </div>

                          {(canEdit
                            || canDelete) && (
                            <div
                              className={`mt-1 flex gap-1 opacity-60 transition group-hover:opacity-100 ${
                                isOwn
                                  ? 'justify-end'
                                  : 'justify-start'
                              }`}
                            >
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(
                                      post.id
                                    );

                                    setEditContent(
                                      post.content
                                      || ''
                                    );
                                  }}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}

                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleDelete(
                                      post
                                    )
                                  }
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
      </div>

      <div className="mavora-workspace-composer shrink-0 border-t px-3 py-3 md:px-5 md:py-4">
        {(imagePreviewUrl
          || audioUrl) && (
            <div className="mb-3 flex flex-wrap gap-3">
              {imagePreviewUrl && (
                <div className="relative">
                  <img
                    src={imagePreviewUrl}
                    alt="Preview"
                    className="h-20 w-20 rounded-xl border object-cover"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setImageFile(
                        null
                      )
                    }
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {audioUrl && (
                <div className="relative rounded-xl border bg-slate-50 py-2 pl-2 pr-9">
                  <audio
                    controls
                    src={audioUrl}
                    className="h-9 max-w-[280px]"
                  />

                  <button
                    type="button"
                    onClick={
                      clearAudio
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>
          )}

        <div className="mb-2 flex flex-wrap items-center gap-2">
          {canViewSensitive && (
            <button
              type="button"
              onClick={() =>
                setIsSensitive(
                  (
                    previous
                  ) =>
                    !previous
                )
              }
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
                isSensitive
                  ? 'border-rose-300 bg-rose-100 text-rose-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <EyeOff size={13} />

              {isSensitive
                ? 'Sensitive ON'
                : 'Sensitive'}
            </button>
          )}

          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <Lock size={11} />
            Private Storage • Tenant Scoped
          </span>
        </div>

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(
              event
            ) => {
              const file =
                event
                  .target
                  .files?.[0];

              if (file) {
                setImageFile(
                  file
                );
              }

              event.currentTarget.value =
                '';
            }}
          />

          <button
            type="button"
            onClick={() =>
              fileInputRef
                .current
                ?.click()
            }
            disabled={
              !canSend
              || !canUpload
              || isSubmitting
            }
            className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            title="Attach image"
          >
            <Paperclip size={20} />
          </button>

          <button
            type="button"
            onClick={
              isRecording
                ? stopRecording
                : () =>
                  void startRecording()
            }
            disabled={
              !canSend
              || !canUpload
              || isSubmitting
            }
            className={`rounded-xl border p-3 transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isRecording
                ? 'animate-pulse border-red-500 bg-red-500 text-white'
                : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title={
              isRecording
                ? 'Stop recording'
                : 'Record audio'
            }
          >
            {isRecording
              ? (
                <Square
                  size={20}
                  fill="currentColor"
                />
              )
              : (
                <Mic size={20} />
              )}
          </button>

          <textarea
            value={content}
            onChange={(
              event
            ) =>
              setContent(
                event.target.value
              )
            }
            onPaste={
              handleImagePaste
            }
            disabled={
              !canSend
              || isSubmitting
            }
            placeholder={
              canSend
                ? label(
                    language,
                    'Message ရေးပါ... Screenshot ကို Paste လုပ်နိုင်ပါသည်။',
                    'Write a message... You can paste screenshots.'
                  )
                : label(
                    language,
                    'Message ပို့ခွင့်မရှိပါ။',
                    'Sending is disabled.'
                  )
            }
            rows={1}
            className="mavora-workspace-input max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border p-3 text-sm font-medium outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
          />

          <button
            type="button"
            onClick={() =>
              void handleSubmit()
            }
            disabled={
              !canSend
              || isSubmitting
              || (
                !content.trim()
                && !imageFile
                && !audioBlob
              )
            }
            className="mavora-workspace-send flex items-center gap-2 rounded-2xl p-3 text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting
              ? (
                <RefreshCw
                  size={20}
                  className="animate-spin"
                />
              )
              : (
                <Send size={20} />
              )}

            <span className="hidden text-sm font-bold sm:inline">
              {isSubmitting
                ? label(
                    language,
                    'ပို့နေသည်...',
                    'Sending...'
                  )
                : label(
                    language,
                    'ပို့မည်',
                    'Send'
                  )}
            </span>
          </button>
        </div>
      </div>

      <WorkspaceAccessControl
        open={isAccessControlOpen}
        onClose={() =>
          setIsAccessControlOpen(
            false
          )
        }
        language={language}
        tenantId={tenantId}
        authUserId={authUserId}
        theme={theme}
        onSaved={() =>
          void loadMyWorkspaceAccess()
        }
      />
    </div>
  );
};
