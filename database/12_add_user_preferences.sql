-- 添加用户偏好设置字段到 profiles 表
-- 2026-02-19: 支持用户设置默认产线和相机

-- 添加默认产线和相机字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS default_line_key VARCHAR(50),
ADD COLUMN IF NOT EXISTS default_camera_id VARCHAR(100);

-- 添加注释
COMMENT ON COLUMN public.profiles.default_line_key IS '用户默认产线 (controller, motor, etc.)';
COMMENT ON COLUMN public.profiles.default_camera_id IS '用户默认相机 ID';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_profiles_default_line ON public.profiles(default_line_key);
CREATE INDEX IF NOT EXISTS idx_profiles_default_camera ON public.profiles(default_camera_id);
