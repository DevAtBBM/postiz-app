'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import { ReactTags } from 'react-tag-autocomplete';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Input } from '@gitroom/react/form/input';
import { ColorPicker } from '@gitroom/react/form/color.picker';
import { Button } from '@gitroom/react/form/button';
import { uniqBy } from 'lodash';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useClickOutside } from '@mantine/hooks';
import clsx from 'clsx';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  TagIcon,
  DropdownArrowIcon,
  PlusIcon,
  CheckmarkIcon,
} from '@gitroom/frontend/components/ui/icons';

export const TagsComponent: FC<{
  name: string;
  label: string;
  initial: any[];
  onChange: (event: {
    target: {
      value: any[];
      name: string;
    };
  }) => void;
}> = (props) => {
  const fetch = useFetch();

  const loadTags = useCallback(async () => {
    return (await fetch('/posts/tags')).json();
  }, []);

  const { data, isLoading, mutate } = useSWR('load-tags', loadTags);

  if (isLoading) {
    return null;
  }

  return <TagsComponentInner {...props} allTags={data} mutate={mutate} />;
};

export const TagsComponentInner: FC<{
  name: string;
  label: string;
  initial: any[];
  allTags: any;
  mutate: () => Promise<any>;
  onChange: (event: {
    target: {
      value: any[];
      name: string;
    };
  }) => void;
}> = ({ initial, onChange, name, mutate, allTags: data }) => {
  const t = useT();
  const fetch = useFetch();
  const [isOpen, setIsOpen] = useState(false);
  const [allowClose, setAllowClose] = useState(true);
  const [tagValue, setTagValue] = useState<any[]>(
    (initial?.slice(0) || []).map((p: any) => {
      return data?.tags.find((a: any) => a.name === p.value) || p;
    })
  );
  const modals = useModals();

  const ref = useClickOutside(() => {
    if (!isOpen || !allowClose) {
      return;
    }
    setIsOpen(false);
  });

  const addTag = useCallback(async () => {
    const val: string | undefined = await new Promise((resolve) => {
      modals.openModal({
        title: t('add_new_tag', 'Add New Tag'),
        children: (close) => (
          <ShowModal tag="" close={close} resolve={resolve} />
        ),
      });
    });

    const newValues = await mutate();

    if (!val) {
      return;
    }

    const newTag = newValues.tags.find((p: any) => p.name === val);
    if (newTag) {
      const modify = [...tagValue, newTag];
      setTagValue(modify);
      onChange({
        target: {
          value: modify,
          name,
        },
      });
    }
  }, []);

  const deleteTag = useCallback(
    async (tag: any, e: React.MouseEvent) => {
      setAllowClose(false);
      e.stopPropagation();
      const confirmed: boolean = await new Promise((resolve) => {
        modals.openModal({
          title: t('delete_tag', 'Delete Tag'),
          children: (close) => (
            <ConfirmDeleteModal
              tagName={tag.name}
              close={close}
              resolve={resolve}
            />
          ),
        });
      });

      if (!confirmed) {
        setTimeout(() => {
          setAllowClose(true);
        }, 500);
        return;
      }

      await fetch(`/posts/tags/${tag.id}`, {
        method: 'DELETE',
      });

      // Remove the tag from current selection if it was selected
      const modify = tagValue.filter((a) => a.id !== tag.id);
      if (modify.length !== tagValue.length) {
        setTagValue(modify);
        onChange({
          target: {
            value: modify.map((p: any) => ({
              label: p.name,
              value: p.name,
            })),
            name,
          },
        });
      }

      await mutate();

      setTimeout(() => {
        setAllowClose(true);
      }, 500);
    },
    [tagValue, name, onChange, mutate, fetch, modals, t]
  );

  return (
    <div
      ref={ref}
      className={clsx(
        'border rounded-[8px] justify-center flex items-center relative h-[44px] text-[15px] font-[600] select-none',
        isOpen ? 'border-[#26B9C0]' : 'border-newTextColor/10'
      )}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-[16px] justify-center flex gap-[8px] items-center h-full select-none flex-1"
      >
        <div className="cursor-pointer">
          <TagIcon />
        </div>
        <div className="cursor-pointer flex gap-[4px]">
          {tagValue.length === 0 ? (
            t('add_new_tag', 'Add New Tag')
          ) : (
            <>
              <div
                className="h-full flex justify-center items-center px-[8px] rounded-[4px]"
                style={{ backgroundColor: tagValue[0].color }}
              >
                <span className="text-shadow-tags text-[#fff]">
                  {tagValue[0].name}
                </span>
              </div>
              {tagValue.length > 1 ? <span>+{tagValue.length - 1}</span> : null}
            </>
          )}
        </div>
        <div className="cursor-pointer">
          <DropdownArrowIcon rotated={isOpen} />
        </div>
      </div>
      {isOpen && (
        <div className="z-[300] absolute start-0 bottom-[100%] w-[240px] bg-newBgColorInner p-[12px] menu-shadow -translate-y-[10px] flex flex-col">
          {(data?.tags || []).map((p: any) => (
            <div
              onClick={() => {
                const exists = !!tagValue.find((a) => a.id === p.id);
                let modify = [];
                if (exists) {
                  modify = tagValue.filter((a) => a.id !== p.id);
                } else {
                  modify = [...tagValue, p];
                }
                setTagValue(modify);
                onChange({
                  target: {
                    value: modify.map((p: any) => ({
                      label: p.name,
                      value: p.name,
                    })),
                    name,
                  },
                });
              }}
              key={p.name}
              className="min-h-[40px] py-[8px] px-[20px] -mx-[12px] flex gap-[8px] items-center group"
            >
              <Check
                onChange={() => {}}
                value={!!tagValue.find((a) => a.id === p.id)}
              />
              <div className="h-full flex items-center flex-1 break-all">
                <span
                  className="text-[#fff] px-[8px] rounded-[8px] text-shadow-tags"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name}
                </span>
              </div>
              {!tagValue.find((a) => a.id === p.id) && (
                <div
                  onClick={(e) => deleteTag(p, e)}
                  className="ms-auto transition-opacity cursor-pointer text-red-500 text-[14px] font-[600]"
                >
                  ×
                </div>
              )}
            </div>
          ))}
          <div
            onClick={addTag}
            className="cursor-pointer gap-[8px] flex w-full h-[34px] rounded-[8px] mt-[12px] px-[16px] justify-center items-center bg-[#26B9C0] text-white"
          >
            <div>
              <PlusIcon />
            </div>
            <div className="text-[13px] font-[600]">
              {t('add_new_tag', 'Add New Tag')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Check: FC<{ value: boolean; onChange: (value: boolean) => void }> = ({
  value,
  onChange,
}) => {
  return (
    <div
      onClick={() => onChange(!value)}
      className={clsx(
        'text-[10px] font-[500] text-center flex border border-btnSimple rounded-[6px] min-w-[20px] min-h-[20px] w-[20px] h-[20px] justify-center items-center',
        value && 'bg-[#26B9C0]'
      )}
    >
      {value ? <CheckmarkIcon className="text-white" /> : ''}
    </div>
  );
};
export const TagsComponentA: FC<{
  name: string;
  label: string;
  initial: any[];
  onChange: (event: {
    target: {
      value: any[];
      name: string;
    };
  }) => void;
}> = (props) => {
  const { onChange, name, initial } = props;
  const fetch = useFetch();
  const [tagValue, setTagValue] = useState<any[]>(initial?.slice(0) || []);
  const [suggestions, setSuggestions] = useState<string>('');
  const [showModal, setShowModal] = useState<any>(false);
  const loadTags = useCallback(async () => {
    return (await fetch('/posts/tags')).json();
  }, []);
  const { isLoading, data, mutate } = useSWR<{
    tags: {
      name: string;
      color: string;
    }[];
  }>('tags', loadTags, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
  const onDelete = useCallback(
    (tagIndex: number) => {
      const modify = tagValue.filter((_, i) => i !== tagIndex);
      setTagValue(modify);
      onChange({
        target: {
          value: modify,
          name,
        },
      });
    },
    [tagValue]
  );
  const createNewTag = useCallback(
    async (newTag: any) => {
      const val = await new Promise((resolve) => {
        setShowModal({
          tag: newTag.value,
          resolve,
          close: () => setShowModal(false),
        });
      });
      setShowModal(false);
      mutate();
      return val;
    },
    [mutate]
  );
  const edit = useCallback(
    (tag: any) => async (e: any) => {
      e.stopPropagation();
      e.preventDefault();
      const val = await new Promise((resolve) => {
        setShowModal({
          tag: tag.name,
          color: tag.color,
          id: tag.id,
          resolve,
          close: () => setShowModal(false),
        });
      });
      setShowModal(false);
      mutate();
      const modify = tagValue.map((t) => {
        if (t.label === tag.name) {
          return {
            value: val,
            label: val,
          };
        }
        return t;
      });
      setTagValue(modify);
      onChange({
        target: {
          value: modify,
          name,
        },
      });
    },
    [tagValue, data]
  );
  const onAddition = useCallback(
    async (newTag: any) => {
      if (tagValue.length >= 3) {
        return;
      }
      const getTag = data?.tags?.find((f) => f.name === newTag.label)
        ? newTag.label
        : await createNewTag(newTag);
      const modify = [
        ...tagValue,
        {
          value: getTag,
          label: getTag,
        },
      ];
      setTagValue(modify);
      onChange({
        target: {
          value: modify,
          name,
        },
      });
    },
    [tagValue, data]
  );

  // useEffect(() => {
  //   const settings = getValues()[props.name];
  //   if (settings) {
  //     setTagValue(settings);
  //   }
  // }, []);

  const suggestionsArray = useMemo(() => {
    return uniqBy<{
      label: string;
      value: string;
    }>(
      [
        ...(data?.tags.map((p) => ({
          label: p.name,
          value: p.name,
        })) || []),
        ...tagValue,
        {
          label: suggestions,
          value: suggestions,
        },
      ].filter((f) => f.label),
      (o) => o.label
    );
  }, [suggestions, tagValue]);

  const t = useT();

  if (isLoading) {
    return null;
  }
  return (
    <>
      {showModal && <ShowModal {...showModal} />}
      <div className="flex-1 flex tags-top">
        <ReactTags 
          placeholderText={t('add_a_tag', 'Add a tag')}
          suggestions={suggestionsArray}
          selected={tagValue}
          onAdd={onAddition}
          onInput={setSuggestions}
          onDelete={onDelete}
          renderTag={(tag) => {
            const findTag = data?.tags?.find((f) => f.name === tag.tag.label);
            const findIndex = tagValue.findIndex(
              (f) => f.label === tag.tag.label
            );
            return (
              <div
                className={`min-w-[50px] float-left mr-[10px] p-[3px] rounded-sm relative justify-center`}
                style={{
                  backgroundColor: findTag?.color,
                }}
              >
                <div
                  className="absolute -top-[5px] start-[15px] text-[12px] bg-forth w-[15px] h-[15px] rounded-full cursor-pointer" title="Edit"
                  onClick={edit(findTag)}
                >
                  {/*{t('edit', 'Edit')}*/}

                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M3.64872 9.84797L3.02266 11.5174C2.99862 11.5817 2.99358 11.6515 3.00815 11.7185C3.02271 11.7856 3.05626 11.847 3.10479 11.8955C3.15333 11.944 3.21479 11.9774 3.28184 11.9919C3.34889 12.0064 3.41869 12.0013 3.48292 11.9772L5.15193 11.3512C5.34296 11.2796 5.51647 11.168 5.66078 11.0238L10.4954 6.18934C10.4954 6.18934 10.3267 5.68383 9.82165 5.17832C9.31661 4.67328 8.81062 4.50462 8.81062 4.50462L3.97605 9.33912C3.83188 9.48344 3.72027 9.65694 3.64872 9.84797ZM9.4848 3.83045L10.1437 3.17152C10.2619 3.05336 10.4196 2.97809 10.5845 3.00572C10.8165 3.04384 11.1714 3.15914 11.5059 3.49408C11.8409 3.82902 11.9562 4.1835 11.9943 4.41553C12.0219 4.58038 11.9466 4.73808 11.8285 4.85624L11.1691 5.51516C11.1691 5.51516 11.0009 5.01013 10.4954 4.5051C9.99032 3.99911 9.4848 3.83045 9.4848 3.83045Z" fill="white"/>
                  </svg>

                </div>
                <div
                  className="absolute -top-[5px] -start-[3px]  text-[12px] bg-red-800 text-white w-[15px] h-[15px] rounded-full cursor-pointer" title="Close"
                  onClick={() => onDelete(findIndex)}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11.25 11.25L7.5 7.5M7.5 7.5L3.75 3.75M7.5 7.5L11.25 3.75M7.5 7.5L3.75 11.25"
                      stroke="white"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="text-white mix-blend-difference">
                  {tag.tag.label}
                </div>
              </div>
            );
          }}
        />
      </div>
    </>
  );
};
const ConfirmDeleteModal: FC<{
  tagName: string;
  close: () => void;
  resolve: (value: boolean) => void;
}> = ({ tagName, close, resolve }) => {
  const t = useT();

  return (
    <div className="flex flex-col gap-[16px]">
      <p className="text-[14px]">
        {t(
          'confirm_delete_tag',
          'Are you sure you want to delete the tag "{{tagName}}"?',
          { tagName }
        )}
      </p>
      <div className="flex gap-[8px] justify-end">
        <Button
          onClick={() => {
            resolve(false);
            close();
          }}
        >
          {t('cancel', 'Cancel')}
        </Button>
        <Button
          onClick={() => {
            resolve(true);
            close();
          }}
          className="bg-red-500 hover:bg-red-600"
        >
          {t('delete', 'Delete')}
        </Button>
      </div>
    </div>
  );
};

const ShowModal: FC<{
  tag: string;
  color?: string;
  id?: string;
  close: () => void;
  resolve: (value: string) => void;
}> = (props) => {
  const t = useT();

  const { close, tag, resolve, color: theColor, id } = props;
  const fetch = useFetch();
  const [color, setColor] = useState<string>(theColor || '#942828');
  const [tagName, setTagName] = useState<string>(tag);
  const save = useCallback(async () => {
    await fetch(id ? `/posts/tags/${id}` : '/posts/tags', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({
        name: tagName,
        color,
      }),
    });
    resolve(tagName);
    close();
  }, [tagName, color, id]);
  return (
    <div>
      <Input
        name="name"
        disableForm={true}
        label={t('tag_name', 'Name')}
        value={tagName}
        onChange={(e) => setTagName(e.target.value)}
      />
      <ColorPicker
        onChange={(e) => setColor(e.target.value)}
        label={t('label_tag_color', 'Tag Color')}
        name="color"
        value={color}
        enabled={true}
        canBeCancelled={false}
      />
      <Button onClick={save} className="mt-[16px]">
        {t('save', 'Save')}
      </Button>
    </div>
  );
};
