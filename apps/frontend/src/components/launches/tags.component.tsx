import { FC, useCallback, useMemo, useState } from 'react';
import { ReactTags } from 'react-tag-autocomplete';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { Input } from '@gitroom/react/form/input';
import { ColorPicker } from '@gitroom/react/form/color.picker';
import { Button } from '@gitroom/react/form/button';
import { uniqBy } from 'lodash';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
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
  }, [tagName, color, id]);
  return (
    <div className="bg-black/40 fixed start-0 top-0 w-full h-full z-[500]">
      <div className="relative w-[500px] mx-auto flex gap-[20px] flex-col flex-1 rounded-[4px] border border-customColor6 bg-sixth p-[16px] pt-0">
        <TopTitle title={`Create a new tag`} />
        <button
          className="outline-none absolute end-[20px] top-[15px] mantine-UnstyledButton-root mantine-ActionIcon-root hover:bg-tableBorder cursor-pointer mantine-Modal-close mantine-1dcetaa"
          type="button"
        >
          <svg
            viewBox="0 0 15 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            onClick={close}
          >
            <path
              d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
            ></path>
          </svg>
        </button>

        <div>
          <Input
            name="name"
            disableForm={true}
            label="Name"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
          />
          <ColorPicker
            onChange={(e) => setColor(e.target.value)}
            label="Tag Color"
            name="color"
            value={color}
            enabled={true}
            canBeCancelled={false}
          />
          <Button onClick={save} className="mt-[16px]">
            {t('save', 'Save')}
          </Button>
        </div>
      </div>
    </div>
  );
};
