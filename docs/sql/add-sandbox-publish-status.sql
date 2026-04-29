alter table review_cases
add column if not exists sandbox_publish_status text default 'not_ready';

update review_cases
set sandbox_publish_status = coalesce(sandbox_publish_status, 'not_ready')
where sandbox_publish_status is null;
